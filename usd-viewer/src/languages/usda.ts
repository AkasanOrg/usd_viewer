import type { languages } from 'monaco-editor';

export const USDA_LANGUAGE_ID = 'usda';

export const usdaLanguageConfiguration: languages.LanguageConfiguration = {
  comments: {
    lineComment: '#',
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
    ['<', '>'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
    { open: '"', close: '"' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
    { open: '"', close: '"' },
  ],
};

export const usdaTokensProvider: languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.usda',

  keywords: [
    'def',
    'class',
    'over',
    'payload',
    'references',
    'inherits',
    'variantSets',
    'variants',
    'prepend',
    'append',
    'delete',
    'add',
    'reorder',
    'relocates',
    'specializes',
    'subLayers',
    'assetInfo',
    'customData',
    'doc',
    'kind',
    'permission',
    'symmetryFunction',
    'active',
    'hidden',
    'instanceable',
  ],

  primTypes: [
    'Xform',
    'Sphere',
    'Cube',
    'Cylinder',
    'Cone',
    'Capsule',
    'Mesh',
    'Scope',
    'Material',
    'Shader',
    'Camera',
    'DistantLight',
    'DomeLight',
    'RectLight',
    'SphereLight',
    'DiskLight',
    'CylinderLight',
    'GeomSubset',
    'Points',
    'BasisCurves',
    'NurbsCurves',
    'NurbsPatch',
    'PointInstancer',
    'SkelRoot',
    'Skeleton',
    'SkelAnimation',
    'BlendShape',
    'Volume',
    'OpenVDBAsset',
    'RenderSettings',
    'RenderProduct',
    'RenderVar',
  ],

  attributePrefixes: ['uniform', 'custom', 'rel', 'varying', 'config'],

  typeKeywords: [
    'bool',
    'uchar',
    'int',
    'uint',
    'int64',
    'uint64',
    'half',
    'float',
    'double',
    'string',
    'token',
    'asset',
    'matrix2d',
    'matrix3d',
    'matrix4d',
    'quatd',
    'quatf',
    'quath',
    'float2',
    'float3',
    'float4',
    'double2',
    'double3',
    'double4',
    'int2',
    'int3',
    'int4',
    'half2',
    'half3',
    'half4',
    'point3f',
    'point3d',
    'point3h',
    'normal3f',
    'normal3d',
    'normal3h',
    'vector3f',
    'vector3d',
    'vector3h',
    'color3f',
    'color3d',
    'color3h',
    'color4f',
    'color4d',
    'color4h',
    'texCoord2f',
    'texCoord2d',
    'texCoord2h',
    'texCoord3f',
    'texCoord3d',
    'texCoord3h',
    'frame4d',
  ],

  operators: ['=', ':', '.'],

  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      // Comments
      [/#.*$/, 'comment'],

      // USDA header
      [/#usda\s+[\d.]+/, 'keyword.control'],

      // SDF paths
      [/<[^>]+>/, 'string.path'],

      // Asset references
      [/@[^@]+@/, 'string.asset'],

      // Triple-quoted strings
      [/"""/, 'string', '@tripleString'],

      // Double-quoted strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string'],

      // Numbers
      [/-?\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/-?\d+/, 'number'],

      // Identifiers and keywords
      [
        /[a-zA-Z_][\w:]*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@primTypes': 'type.identifier',
            '@attributePrefixes': 'keyword.modifier',
            '@typeKeywords': 'type',
            '@default': 'identifier',
          },
        },
      ],

      // Namespaced attributes (primvars:, xformOp:, etc.)
      [/[a-zA-Z_][\w]*:[\w:]+/, 'variable.name'],

      // Whitespace
      { include: '@whitespace' },

      // Delimiters and operators
      [/[{}()\[\]]/, '@brackets'],
      [/[<>]/, '@brackets'],
      [/@symbols/, 'operator'],
      [/[;,.]/, 'delimiter'],
    ],

    whitespace: [[/[ \t\r\n]+/, 'white']],

    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],

    tripleString: [
      [/[^"]+/, 'string'],
      [/"""/, 'string', '@pop'],
      [/"/, 'string'],
    ],
  },
};

export const usdaTheme: { base: 'vs-dark'; inherit: boolean; rules: { token: string; foreground?: string; fontStyle?: string }[]; colors: Record<string, string> } = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955' },
    { token: 'keyword', foreground: '569CD6' },
    { token: 'keyword.control', foreground: 'C586C0' },
    { token: 'keyword.modifier', foreground: '4EC9B0' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'type.identifier', foreground: '4EC9B0', fontStyle: 'bold' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'string.path', foreground: 'D7BA7D' },
    { token: 'string.asset', foreground: 'D7BA7D' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'number.float', foreground: 'B5CEA8' },
    { token: 'variable.name', foreground: '9CDCFE' },
    { token: 'identifier', foreground: 'DCDCAA' },
    { token: 'operator', foreground: 'D4D4D4' },
    { token: 'delimiter', foreground: 'D4D4D4' },
  ],
  colors: {
    'editor.background': '#1e1e1e',
  },
};

export function registerUsdaLanguage(monaco: typeof import('monaco-editor')) {
  monaco.languages.register({ id: USDA_LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(USDA_LANGUAGE_ID, usdaLanguageConfiguration);
  monaco.languages.setMonarchTokensProvider(USDA_LANGUAGE_ID, usdaTokensProvider);
  monaco.editor.defineTheme('usda-dark', usdaTheme);
}
