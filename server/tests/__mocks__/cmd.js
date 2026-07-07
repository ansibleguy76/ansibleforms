const mockProcess = {
  stdout: { on: () => {} },
  stderr: { on: () => {} },
  on: () => {},
};

export default {
  executeSilentCommand: async () => 'mock-output',
  runCommand: () => mockProcess,
  killChildren: () => {},
};
