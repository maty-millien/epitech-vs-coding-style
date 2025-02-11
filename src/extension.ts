import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { BANNED_EXTENSIONS } from "./constants";
import { createDiagnostics } from "./diagnostics";
import { executeDockerCheck } from "./docker";
import { parseReportFile } from "./parser";

/**
 * Activates the extension and registers event listeners.
 */
export function activate(context: vscode.ExtensionContext) {
  const collection =
    vscode.languages.createDiagnosticCollection("coding-style");

  const runAnalysis = async (doc: vscode.TextDocument) => {
    const config = vscode.workspace.getConfiguration("epitech-coding-style");
    if (!config.get("enable")) {
      collection.clear();
      return;
    }

    if (BANNED_EXTENSIONS.includes(doc.languageId)) {
      return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!workspaceFolder) {
      console.log("No workspace folder found, skipping analysis...");
      return;
    }

    try {
      const reportPath = await executeDockerCheck(doc.fileName);
      const fileErrorsMap = parseReportFile(
        reportPath,
        workspaceFolder.uri.fsPath
      );
      collection.clear();
      Object.entries(fileErrorsMap).forEach(([filePath, errors]) => {
        const absolutePath = path.resolve(workspaceFolder.uri.fsPath, filePath);
        const fileUri = vscode.Uri.file(absolutePath);
        const diagnostics = createDiagnostics(errors);
        collection.set(fileUri, diagnostics);
      });
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Coding style check failed: ${error}`);
    }
  };

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(runAnalysis),
    vscode.workspace.onDidOpenTextDocument(runAnalysis),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("epitech-coding-style.enable")) {
        const config = vscode.workspace.getConfiguration(
          "epitech-coding-style"
        );
        if (!config.get("enable")) {
          collection.clear();
        } else {
          vscode.workspace.textDocuments.forEach(runAnalysis);
        }
      }
    })
  );
}

export function deactivate() {}
