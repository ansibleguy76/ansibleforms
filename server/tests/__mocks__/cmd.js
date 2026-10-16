const mockProcess = {
  stdout: { on: () => {} },
  stderr: { on: () => {} },
  on: () => {},
};

export default {
  executeSilentCommand: async () => 'mock-output',
  runCommand: () => mockProcess,
  killChildren: () => {},
  // the program is there unless a test says otherwise
  isAvailable: () => true,
  splitCommand: (command) => String(command).split(/\s+/).filter(Boolean),
  maskUrlCredentials: (text) => String(text ?? ""),
};
