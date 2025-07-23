'use strict';

class RestResult {
  // For a single item
  static single(data) {
    return data ;
  }

  // For a list
  static list(records) {
    return {
      count: Array.isArray(records) ? records.length : 0,
      records: records || []
    };
  }

  // For an error
  static error(message, details = undefined) {
    const err = { error: message };
    if (details !== undefined) err.details = details;
    return err;
  }
}

export default RestResult;
