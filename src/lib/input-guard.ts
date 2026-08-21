'use client';

/**
 * Guards against running a file through the wrong converter.
 *
 * Several tools come in mirrored pairs whose cards read almost identically
 * ("PowerPoint to PDF" / "PDF to PowerPoint"). Without a check, dropping a
 * presentation into the export tool produces a confusing result instead of an
 * explanation, so each tool states what it accepts and names the tool that
 * does what the user probably wanted.
 */
export interface ExpectedInput {
  /** Extensions this tool converts FROM, e.g. ['.pptx']. */
  extensions: string[];
  /** Human label for the expected input, e.g. 'a PowerPoint presentation'. */
  label: string;
  /** The mirrored tool, offered when the user brought its input instead. */
  counterpart?: { extensions: string[]; toolName: string; does: string };
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

export function assertExpectedInput(file: File, expected: ExpectedInput): void {
  const ext = extensionOf(file.name);
  if (expected.extensions.includes(ext)) return;

  const c = expected.counterpart;
  if (c && c.extensions.includes(ext)) {
    throw new Error(
      `"${file.name}" is not ${expected.label} — this tool starts from ${expected.label}. ` +
      `To ${c.does}, use the "${c.toolName}" tool instead.`,
    );
  }

  throw new Error(
    `This tool needs ${expected.label} (${expected.extensions.join(' or ')}). ` +
    `"${file.name}" is ${ext ? `a ${ext.slice(1).toUpperCase()} file` : 'a different format'}.`,
  );
}
