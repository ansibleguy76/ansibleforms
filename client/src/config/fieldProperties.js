/******************************************************************/
/*                                                                */
/*  A form field's properties, as a form's Visual tab offers them */
/*  (components/AppFormVisualEditor.vue) : each its kind of input */
/*  - text, number, switch, a choice (an enum), a scalar (text or */
/*  a number), or YAML (a list, an object) - and its one-line     */
/*  description, and for YAML what a new one starts as. The name, */
/*  type, label, required, help, default, output and values are   */
/*  not here : the tab shows them itself.                         */
/*                                                                */
/*  Generated from server/schema/form_schema.json (the kinds) and */
/*  server/help.yaml (the descriptions) ; tests/field-properties  */
/*  .test.js fails when the schema moves without it.              */
/*                                                                */
/******************************************************************/

export const fieldProperties = [
  {
    key: 'placeholder',
    kind: 'text',
    short: 'In-field help value',
  },
  {
    key: 'group',
    kind: 'text',
    short: 'The field group name',
  },
  {
    key: 'accept',
    kind: 'yaml',
    short: 'File types the picker offers',
    init: [],
  },
  {
    key: 'evalDefault',
    kind: 'switch',
    short: 'Evaluates default value',
  },
  {
    key: 'dateType',
    kind: 'select',
    options: ['date', 'datetime', 'year', 'month', 'time', 'week'],
    short: 'DateType of the datetime picker',
  },
  {
    key: 'convertToUtc',
    kind: 'switch',
    short: 'Convert datetime to UTC',
  },
  {
    key: 'asCredential',
    kind: 'switch',
    short: 'Send credential as extravar',
  },
  {
    key: 'line',
    kind: 'text',
    short: 'The field line name',
  },
  {
    key: 'width',
    kind: 'text',
    short: 'The field width',
  },
  {
    key: 'sameAs',
    kind: 'text',
    short: 'An field based validation (field must be same as other field)',
  },
  {
    key: 'validIf',
    kind: 'yaml',
    short: 'An field based validation (field must be true)',
    init: {},
  },
  {
    key: 'validIfNot',
    kind: 'yaml',
    short: 'An field based validation (field must be false)',
    init: {},
  },
  {
    key: 'regex',
    kind: 'yaml',
    short: 'A regular expression validation',
    init: {},
  },
  {
    key: 'notIn',
    kind: 'yaml',
    short: 'A list validation (can not be in list)',
    init: {},
  },
  {
    key: 'in',
    kind: 'yaml',
    short: 'A list validation (must be in list)',
    init: {},
  },
  {
    key: 'minValue',
    kind: 'scalar',
    short: 'Field minimum value',
  },
  {
    key: 'maxValue',
    kind: 'scalar',
    short: 'Field maximum value',
  },
  {
    key: 'minSize',
    kind: 'scalar',
    short: 'File minimum size',
  },
  {
    key: 'maxSize',
    kind: 'scalar',
    short: 'File maximum size',
  },
  {
    key: 'minLength',
    kind: 'scalar',
    short: 'Field minimum length',
  },
  {
    key: 'maxLength',
    kind: 'scalar',
    short: 'Field maximum length',
  },
  {
    key: 'expression',
    kind: 'text',
    short: 'A javascript expression.',
  },
  {
    key: 'ignoreIncomplete',
    kind: 'switch',
    short: 'Allow form submit on non-evaluated placeholders',
  },
  {
    key: 'noLog',
    kind: 'switch',
    short: 'Disable backend logging',
  },
  {
    key: 'keydown',
    kind: 'switch',
    short: 'Enable responsiveness',
  },
  {
    key: 'refresh',
    kind: 'yaml',
    short: 'Allow a manual or auto refresh',
    init: '',
  },
  {
    key: 'isHtml',
    kind: 'switch',
    short: 'Renders text as html',
  },
  {
    key: 'runLocal',
    kind: 'switch',
    short: 'Run an expression locally',
  },
  {
    key: 'query',
    kind: 'text',
    short: 'The query to select data from a database',
  },
  {
    key: 'jq',
    kind: 'text',
    short: 'Transform database query results with jq',
  },
  {
    key: 'outputObject',
    kind: 'switch',
    short: 'Output the selection of a enum-field as a full object.',
  },
  {
    key: 'titleAdd',
    kind: 'text',
    short: 'Title shown in the subform pane when adding a new row',
  },
  {
    key: 'titleEdit',
    kind: 'text',
    short: 'Title shown in the subform pane when editing an existing row',
  },
  {
    key: 'switch',
    kind: 'switch',
    short: 'Show checkbox as switch',
  },
  {
    key: 'columns',
    kind: 'yaml',
    short: 'The list of columns visible in the dropdown/table',
    init: [],
  },
  {
    key: 'pctColumns',
    kind: 'yaml',
    short: 'The list of columns that should visualized as a percentage-bar',
    init: [],
  },
  {
    key: 'filterColumns',
    kind: 'yaml',
    short: 'The list of columns that you can filter on',
    init: [],
  },
  {
    key: 'allowDelete',
    kind: 'switch',
    short: 'Allow table/list delete',
  },
  {
    key: 'allowInsert',
    kind: 'switch',
    short: 'Allow table/list insert',
  },
  {
    key: 'deleteMarker',
    kind: 'text',
    short: 'Adds an additional deletemarker field',
  },
  {
    key: 'insertMarker',
    kind: 'text',
    short: 'Adds an additional insertmarker field',
  },
  {
    key: 'updateMarker',
    kind: 'text',
    short: 'Adds an additional updatemarker field',
  },
  {
    key: 'sticky',
    kind: 'switch',
    short: 'Make a dropdown box permanently visible',
  },
  {
    key: 'horizontal',
    kind: 'switch',
    short: 'Converts a dropdown box to a horizontal selector',
  },
  {
    key: 'editable',
    kind: 'switch',
    short: 'Makes an expression editable',
  },
  {
    key: 'readonly',
    kind: 'switch',
    short: 'Display YAML in readonly mode',
  },
  {
    key: 'showLoadButton',
    kind: 'switch',
    short: 'Show load button for file import',
  },
  {
    key: 'showDownloadButton',
    kind: 'switch',
    short: 'Show download button for file export',
  },
  {
    key: 'yamlError',
    kind: 'yaml',
    short: 'Custom YAML validation error message',
    init: {},
  },
  {
    key: 'valueColumn',
    kind: 'text',
    short: 'The column of a selected item that needs to exported as extravar',
  },
  {
    key: 'previewColumn',
    kind: 'text',
    short: 'The column of the selected item(s) that is shown in the dropdown-preview',
  },
  {
    key: 'placeholderColumn',
    kind: 'text',
    short: 'The column of a selected item that is used in a placeholder',
  },
  {
    key: 'dbConfig',
    kind: 'yaml',
    short: 'A database connection',
    init: '',
  },
  {
    key: 'model',
    kind: 'yaml',
    short: 'Extravar modelling',
    init: '',
  },
  {
    key: 'value',
    kind: 'yaml',
    short: 'A fixed value (any type) for the expression',
    init: '',
  },
  {
    key: 'multiple',
    kind: 'switch',
    short: 'Allow multiple selection',
  },
  {
    key: 'size',
    kind: 'number',
  },
  {
    key: 'dependencyFn',
    kind: 'select',
    options: ['and', 'or', 'nand', 'nor'],
    short: 'The dependency logical function',
  },
  {
    key: 'dependencies',
    kind: 'yaml',
    short: 'Show/hide this field based on the values or other fields',
    init: [],
  },
  {
    key: 'hide',
    kind: 'switch',
    short: 'Hides an expression field',
  },
  {
    key: 'icon',
    kind: 'text',
    short: 'Field icon',
  },
  {
    key: 'iconColor',
    kind: 'text',
  },
  {
    key: 'iconSize',
    kind: 'text',
  },
  {
    key: 'overlayIcon',
    kind: 'text',
  },
  {
    key: 'overlayIconTransform',
    kind: 'text',
  },
  {
    key: 'overlayIconColor',
    kind: 'text',
  },
  {
    key: 'overlayIconCircle',
    kind: 'switch',
  },
  {
    key: 'overlayIconText',
    kind: 'text',
  },
  {
    key: 'overlayIconTextPosition',
    kind: 'text',
  },
  {
    key: 'overlayIconTextColor',
    kind: 'text',
  },
  {
    key: 'subform',
    kind: 'text',
    short: 'Name of the subform that defines one row',
  },
];
