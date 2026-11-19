import React, { useEffect, useRef, useCallback } from 'react';

const RichTextEditor = ({ value, onChange, className = '', minHeight = '140px' }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    handleInput();
  };

  return (
    <div className={`${className} border border-gray-300 rounded-lg flex flex-col overflow-hidden`}>
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => exec('bold')}
          className="px-2 py-1 text-sm font-bold rounded hover:bg-gray-200 active:bg-blue-100 active:text-blue-600 transition-all"
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => exec('italic')}
          className="px-2 py-1 text-sm italic rounded hover:bg-gray-200 active:bg-blue-100 active:text-blue-600 transition-all"
          title="Italic"
        >
          <em>I</em>
        </button>
        <select
          onChange={(e) => exec('fontSize', e.target.value)}
          defaultValue="3"
          className="text-xs px-1.5 py-1 rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
          title="Font Size"
        >
          <option value="1">Smallest</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Medium</option>
          <option value="5">Large</option>
          <option value="6">Extra Large</option>
          <option value="7">Huge</option>
        </select>
        <select
          onChange={(e) => exec('fontName', e.target.value)}
          className="text-xs px-1.5 py-1 rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
          title="Font Family"
        >
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Verdana">Verdana</option>
          <option value="Georgia">Georgia</option>
          <option value="Comic Sans MS">Comic Sans MS</option>
          <option value="Impact">Impact</option>
        </select>
        <input
          type="color"
          onChange={(e) => exec('foreColor', e.target.value)}
          className="p-0 border-0 bg-transparent cursor-pointer h-6 w-6 rounded"
          title="Font Color"
        />
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        className={`min-h-[${minHeight}] max-h-[400px] p-3 text-gray-900 focus:outline-none break-words overflow-y-auto`}
        style={{ minHeight }}
      />
    </div>
  );
};

export default RichTextEditor;
