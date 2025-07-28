// Initialize CodeMirror editor
const editor = CodeMirror(document.getElementById('editor'), {
    mode: 'javascript',
    theme: 'nord',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    matchBrackets: true,
    autoCloseBrackets: true,
    lineWrapping: true,
    extraKeys: {
        'Ctrl-Enter': () => window.modeler.executeCode(),
        'Cmd-Enter': () => window.modeler.executeCode(),
        'Ctrl-/': 'toggleComment',
        'Cmd-/': 'toggleComment'
    },
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
});

// Set default options
editor.setOption('foldGutter', true);
editor.setOption('styleActiveLine', true);

// Add some helpful text when empty
editor.on('change', (cm) => {
    if (cm.getValue() === '') {
        cm.display.wrapper.classList.add('empty');
    } else {
        cm.display.wrapper.classList.remove('empty');
    }
});