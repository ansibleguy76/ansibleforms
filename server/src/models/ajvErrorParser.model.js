var AJVError = {
    Type: 'type',
    Maximum: 'maximum',
    Minimum: 'minimum',
    ExclusiveMinimum: 'exclusiveMinimum',
    ExclusiveMaximum: 'exclusiveMaximum',
    MultipleOf: 'multipleOf',
    MinLength: 'minLength',
    MaxLength: 'maxLength',
    Pattern: 'pattern',
    Format: 'format',
    MaxItems: 'maxItems',
    MinItems: 'minItems',
    UniqueItems: 'uniqueItems',
    Contains: 'contains',
    MaxProperties: 'maxProperties',
    MinProperties: 'minProperties',
    Required: 'required',
    AdditionalProperties: 'additionalProperties',
    Dependencies: 'dependencies',
    PropertyNames: 'propertyNames',
    Enum: 'enum',
    Const: 'const',
    Not: 'not',
    OneOf: 'oneOf',
    AnyOf: 'anyOf',
    AllOf: 'allOf',
    If: 'if'
};

function getAJVErrorMessage(opts) {
    if (!opts) {
        opts = {};
    }
    var keyword = opts.keyword;
    var message = opts.message;
    var params = opts.params;
    var instancePath = opts.instancePath;

    instancePath = instancePath.slice(1).replace(/\//g, '.');
    message = message.toLowerCase();
    var msg = '';
    switch (keyword) {
        case AJVError.AdditionalProperties: {
            msg = message + ' \'' + params.additionalProperty + '\'';
            if (instancePath.trim()) {
                msg = msg + ' in ' + instancePath;
            }
            break;
        }
        case AJVError.Not: {
            msg = instancePath.trim();
            if (msg) {
                msg = msg + ' is/are ';
            }
            msg = msg + 'not valid';
            break;
        }
        case AJVError.OneOf:
        case AJVError.AnyOf: {
            msg = message.slice(0, -9);
            break;
        }
        default: {
            if (!instancePath.trim()) {
                msg = message;
                break;
            }
            msg = instancePath + ' ' + message;
            break;
        }
    }
    return msg;
}

var AJVErrorParser = {};

AJVErrorParser.getAJVErrorMessage = getAJVErrorMessage;
AJVErrorParser.parseErrors = function(errors, opts) {
    if (!opts || opts.json === undefined) {
        opts = { json: true };
    }
    var json = opts.json;
    var delimiter = opts.delimiter || '\n';
    var slice = opts.slice || 0;
    var messages = [];
    for (var idx = 0; idx < errors.length; idx++) {
        var error = errors[idx];
        messages.push(getAJVErrorMessage(error));
    }
    if (json) {
        return messages;
    }
    var response = delimiter + messages.join(delimiter);
    return response.slice(slice);
};

export default AJVErrorParser;