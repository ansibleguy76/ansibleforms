const Helpers = {
  findDuplicates(arry) {
    return arry.filter((item, index) => arry.indexOf(item) !== index);
  },
  forceFileDownload(response) {
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    let filename = response.headers["content-disposition"]
      .split("filename=")[1]
      .replace(/"/g, "");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
  },
  htmlEncode(v){
    return v.toString().replace(/[\u00A0-\u9999<>\&]/g, function(i) { //eslint-disable-line
      return '&#'+i.charCodeAt(0)+';';
    });
  },  
  parseAxiosResponseError(err, custom="An error occurred") {
    // Parse Axios error
    if (err.response) {
      // The request was made and the server responded with a status
      const message = err.response.data?.message || err.response.data?.error || custom;
      const details = err.response.data?.details;
      return details ? `${message}: ${details}` : message;
    } else{
      return err.message || custom;
    }
  },
  // Cookie helpers for simple client-side persistence
  setCookie(name, value, days = 365) {
    try{
      const d = new Date();
      d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
      const expires = "expires=" + d.toUTCString();
      document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
    }catch(e){
      console.error('setCookie failed', e)
    }
  },
  getCookie(name) {
    try{
      const cname = encodeURIComponent(name) + "=";
      const decoded = decodeURIComponent(document.cookie || "");
      const parts = decoded.split('; ');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].indexOf(cname) === 0) return parts[i].substring(cname.length);
      }
      return null;
    }catch(e){
      return null
    }
  },
  deleteCookie(name){
    try{
      document.cookie = encodeURIComponent(name) + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
    }catch(e){
      console.error('deleteCookie failed', e)
    }
  },
  // Normalize a string to a safe form: remove accents, lowercase, replace non-alphanumerics with
  // underscores, collapse multiple underscores and trim leading/trailing underscores.
  cleanupString(v){
    if (v === undefined || v === null) return '';
    try{
      // normalize and remove diacritics
      let s = String(v).normalize('NFKD').replace(/\p{M}/gu, '');
      s = s.toLowerCase();
      // replace any non-alphanumeric characters with underscore
      s = s.replace(/[^a-z0-9]+/g, '_');
      // collapse multiple underscores
      s = s.replace(/_+/g, '_');
      // trim leading/trailing underscores
      s = s.replace(/^_+|_+$/g, '');
      return s;
    }catch(e){
      return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
    }
  },
  getJobMessageByStatus(status) {
    // get the message by status
    // used in the job list
    switch (status) {
      case "running":
        return "Job is running";
      case "success":
        return "Job completed successfully";
      case "failed":
        return "Job failed";
      case "approve":
        return "Job is waiting for approval";
      case "warning":
        return "Job completed with warnings";
      case "aborted":
        return "Job was aborted";
      case "rejected":
        return "Job was rejected";
      case "abandoned":
        return "Job was abandoned";
      default:
        return "Unknown job status";
    }
  },
  getColorClassByStatus(status, prefix = "text") {
    // get the color class by status
    // used in the job list
    switch (status) {
      case "running":
        return prefix + "-info";
      case "success":
        return prefix + "-success";
      case "failed":
        return prefix + "-danger";
      case "approve":
      case "warning":
      case "aborted":
      case "rejected":
      case "abandoned":
        return prefix + "-warning";
      default:
        return "body";
    }
  },
  humanFileSize(size) {
    if(size==undefined)return "Not a number"
    var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
  },  
  deepClone(o){
    if(o===undefined){
      return o
    }
    try{
      return (JSON.parse(JSON.stringify(o)))
    }catch(e){
      console.error("Failed deepcloning - ",e)
      return undefined
    }
    
  },
  // Build a field-driven output object (the same shape used for main-form
  // extravars). Honours `noOutput`, `outputObject`, `valueColumn`, dotted
  // `model` paths (including array indexes like `a.b[0].c`) and the datetime
  // month fix (0-11 -> 1-12). Pure function - returns a new object.
  //
  //   fields      : array of formfield definitions
  //   raw         : a flat { fieldName: value } source (e.g. form.value or a
  //                 subform draft)
  //   opts.isVisible : optional (item) => boolean; fields that are not
  //                 visible are skipped (used by the main form)
  //   opts.overrides : optional { fieldName: value } map - when a name is
  //                 present here it is used instead of `raw[name]` (used by
  //                 the main form to inject uploaded file metadata)
  //   opts.subforms : optional array of subform definitions; used to resolve
  //                 `field.subform` (string name) to the subform object so
  //                 list rows are rebuilt recursively through the subform's
  //                 fields (honours model/noOutput/outputObject per row)
  buildFormOutput(fields, raw, opts = {}){
    const isVisible = opts.isVisible || (() => true);
    const overrides = opts.overrides || {};
    const subforms = opts.subforms || [];
    const subformByName = Object.fromEntries((subforms || []).map((s) => [s.name, s]));
    const fd = {};
    (fields || []).forEach((item) => {
      if (!item || !item.name) return;
      if (item.name === '__user__') return;
      if (item.name === '__parent__') return;
      if (item.noOutput || item.output === false) return;
      if (!isVisible(item)) return;

      const outputObject =
        item.outputObject ||
        item.type === 'expression' ||
        item.type === 'file' ||
        item.type === 'table' ||
        item.type === 'list' ||
        item.type === 'yaml' ||
        item.type === 'datetime' ||
        false;

      let outputValue = (item.name in overrides) ? overrides[item.name] : this.deepClone(raw?.[item.name]);

      if (item.type === 'datetime' && item.dateType === 'month' && outputValue && typeof outputValue === 'object') {
        outputValue = {
          ...outputValue,
          month: typeof outputValue.month === 'number' ? outputValue.month + 1 : outputValue.month,
        };
      }

      if (!outputObject) {
        outputValue = this.getFieldValue(outputValue, item.valueColumn || '', true);
      }

      // Recursively re-shape list rows through the subform's field defs so
      // that `model`, `noOutput`, `outputObject`, `valueColumn` declared on
      // subform fields are honoured in the extravars. `item.subform` may
      // already be an object (subform inlined by the server) or a name
      // looked up against opts.subforms. Missing subform or non-array value
      // -> pass through unchanged.
      if (item.type === 'list' && Array.isArray(outputValue)) {
        const sub = (typeof item.subform === 'string')
          ? subformByName[item.subform]
          : item.subform;
        if (sub && Array.isArray(sub.fields)) {
          outputValue = outputValue.map((row) =>
            this.buildFormOutput(sub.fields, row || {}, { subforms })
          );
        }
      }

      const fieldmodel = [].concat(item.model || []);
      if (fieldmodel.length === 0) {
        fd[item.name] = this.deepClone(outputValue);
        return;
      }

      fieldmodel.forEach((f) => {
        f.split(/\s*\.\s*/).reduce((master, obj, level, arr) => {
          let arrsplit;
          if (level === arr.length - 1) {
            if (obj.match(/.*\[[0-9]+\]$/)) {
              arrsplit = obj.split(/\[([0-9]+)\]$/);
              if (master[arrsplit[0]] === undefined) master[arrsplit[0]] = [];
              if (master[arrsplit[0]][arrsplit[1]] === undefined) master[arrsplit[0]][arrsplit[1]] = {};
              master[arrsplit[0]][arrsplit[1]] = outputValue;
              return master[arrsplit[0]][arrsplit[1]];
            }
            if (master[obj] === undefined) {
              master[obj] = outputValue;
            } else if (typeof master[obj] !== 'object' || master[obj] === null || typeof outputValue !== 'object' || outputValue === null) {
              master[obj] = outputValue;
            } else {
              master[obj] = { ...master[obj], ...outputValue };
            }
            return master[obj];
          }
          if (obj.match(/.*\[[0-9]+\]$/)) {
            arrsplit = obj.split(/\[([0-9]+)\]$/);
            if (master[arrsplit[0]] === undefined) master[arrsplit[0]] = [];
            if (master[arrsplit[0]][arrsplit[1]] === undefined) master[arrsplit[0]][arrsplit[1]] = {};
            return master[arrsplit[0]][arrsplit[1]];
          }
          if (typeof master !== 'object' || master === null) return {};
          if (master[obj] === undefined) master[obj] = {};
          return master[obj];
        }, fd);
      });
    });
    return fd;
  },  
  getFieldValue(field, column, keepArray) {

  // get the value of a field
  // can be many things and more complex than you think
  // if a record is selected in a query for example
  // the value can be the valueColumn, ....
  // sometimes we want undefined, sometimes if array, an empty array
  // sometimes if array of objects, we want it flattened by column

    var keys = undefined;
    var key = undefined;
    var wasArray = false;
    // do we pass a field
    if (field) {
        // first we force to array
        if (Array.isArray(field)) {
            wasArray = true;
        } else {
            field = [].concat(field ?? []); // force to array
        }
        // any value
        if (field.length > 0) { // not empty
            if (column != "*") {
                if (typeof field[0] === "object") { // array of objects, analyze first object
                    keys = Object.keys(field[0]); // get properties
                    if (keys.length > 0) {
                        key = (keys.includes(column)) ? column : keys[0]; // get column, fall back to first
                        field = field.map((item) => ((item) ? ((item[key] == null) ? null : (item[key] ?? item)) : undefined)); // flatten array
                    } else {
                        field = (!keepArray) ? undefined : field; // force undefined if we don't want arrays
                    }
                } // no else, array is already flattened
            }

            field = (!wasArray || !keepArray) ? field[0] : field; // if it wasn't an array, we take first again
        } else {
            field = (!keepArray) ? undefined : field; // force undefined if we don't want arrays
        }
    }
    if (field == '__auto__' || field == '__none__' || field == '__all__') {
        field = undefined;
    }
    return field;
  },
  replacePlaceholders(match,object){
    if(match.match(/^[a-zA-Z0-9_\-\[\]\.]*$/)){ /* eslint-disable-line */
      var to_eval="object"+match.replaceAll("[",".").replaceAll("]",".").split(".").filter(x=>!(x==="")).map(x=>{return "["+((/^-?\d+$/.test(x))?x:"'"+x+"'")+"]"}).join("")
      // console.log(to_eval)
      return eval(to_eval)
    } else{
      return `$(${match})` // return original
    }
  },  
  forceFileDownload(response) {
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    let filename = response.headers['content-disposition'].split('filename=')[1].replace(/"/g, '')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
  },
  diff(arrA, arrB) {
    let diff = [];
    function isEq(a, b) {
      // Handle null/undefined cases
      if (a === b) return true;
      if (a == null || b == null) return false;
      if (typeof a !== 'object' || typeof b !== 'object') return a === b;
      
      var aProps = Object.getOwnPropertyNames(a);
      var bProps = Object.getOwnPropertyNames(b);
      if (aProps.length != bProps.length) {
        return false;
      }
      for (var i = 0; i < aProps.length; i++) {
        var propName = aProps[i];
        if (a[propName] !== b[propName]) {
          return false;
        }
      }
      return true;
    }      
    arrA.forEach(itemA => {
      if (!arrB.some(itemB => isEq(itemA, itemB))) {
        diff.push(itemA);
      }
    })
    arrB.forEach(itemB => {
      if (!diff.some(p => isEq(itemB, p)) && !arrA.some(itemA => isEq(itemA, itemB))) {
        diff.push(itemB);
      }
    })
    return diff;
  },
  evalSandbox(expression){
    function fnToTable(data, {
          tableClass = '',
          escapeHtml = true,
          emptyCell = '',
          includeHeader = true
        } = {}){
      if (!Array.isArray(data) || data.length === 0) {
        return '<table' + (tableClass ? ` class="${tableClass}"` : '') + '></table>';
      }
      const escape = escapeHtml
        ? (s) => String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
        : (s) => String(s);
      const columns = [...new Set(data.flatMap(obj => Object.keys(obj)))];
      const thead = includeHeader
        ? '<thead><tr>' + columns.map(col => `<th>${escape(col)}</th>`).join('') + '</tr></thead>'
        : '';
      const tbody = '<tbody>' + data.map(row =>
        '<tr>' + columns.map(col =>
          `<td>${row[col] === undefined || row[col] === null ? emptyCell : escape(row[col])}</td>`
        ).join('') + '</tr>'
      ).join('') + '</tbody>';
      return `<table${tableClass ? ` class="${tableClass}"` : ''}>${thead}${tbody}</table>`;
    }    
    // local autonumbering
    function fnGetNumberedName(names,pattern,value,fillgap=false){
      var nr=null
      var nrsequence
      var regex
      var nrs
      var re=new RegExp("[^\#]*(\#+)[^\#]*") // eslint-disable-line
      var patternmatch=re.exec(pattern)
      if(!names || !Array.isArray(names)){
        // console.log("fnGetNumberedName, No input or no array")
        return value
      }
      if(patternmatch && patternmatch.length==2){
        nrsequence=patternmatch[1]
        regex="^" + pattern.replace(nrsequence,"([0-9]{"+nrsequence.length+"})") + "$"
        nrs=names.map((item)=>{
          var regexp=new RegExp(regex,"g");
          var matches=regexp.exec(item)
          if(matches && matches.length==2){
            return parseInt(matches[1])
          }else{
            null
          }
        }).filter((item)=>(item))
        var gaps=nrs.reduce(function(acc, cur, ind, arr) {
          var diff = cur - arr[ind-1];
          if (diff > 1) {
            var i = 1;
            while (i < diff) {
              acc.push(arr[ind-1]+i);
              i++;
            }
          }
          return acc;
        }, []);
        var max=(nrs.length>0)?Math.max(...nrs):null
        var gap=(gaps.length>0)?Math.min(...gaps):null
        if(max){
          nr=max+1
        }
        if(fillgap && gap){
          nr=gap
        }
        if(nr){
          var tmp = pattern.replace(nrsequence,nr.toString().padStart(nrsequence.length,"0"))
          return tmp
        }else{
          // console.log("fnGetNumberedName, no pattern matches found in the list")
          return value
        }
      }else{
        // console.log("fnGetNumberedName, no pattern found, use ### for numbers")
        return value
      }
    }    
    function matchRuleShort(str, rule) {
      var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"); // eslint-disable-line
      return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str); // eslint-disable-line
    }

    function compareProps(x1,x2,p){
      for(let i=0;i<p.length;i++){
        const x=p[i]

        if(!matchRuleShort(x1[x],x2[x])){
          return false
        }
      }
      return true
    }

    function comparePropsRegex(x1,x2,p){
      for(let i=0;i<p.length;i++){
        const x=p[i]

        if(!x1[x].match(x2[x])){
          return false
        }
      }
      return true
    }

    function dynamicSort(property) {
        var sortOrder = 1;
        if(property[0] === "-") {
            sortOrder = -1;
            property = property.substr(1);
        }
        return function (a,b) {
            /* next line works with strings and numbers,
             * and you may want to customize it to your needs
             */
            var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
            return result * sortOrder;
        }
    }

    function dynamicSortMultiple() {
        /*
         * save the arguments object as it will be overwritten
         * note that arguments object is an array-like object
         * consisting of the names of the properties to sort by
         */
        var props = arguments;
        return function (obj1, obj2) {
            var i = 0, result = 0, numberOfProperties = props.length;
            /* try getting a different result from 0 (equal)
             * as long as we have extra properties to compare
             */
            while(result === 0 && i < numberOfProperties) {
                result = dynamicSort(props[i])(obj1, obj2);
                i++;
            }
            return result;
        }
    }


    class fnArray extends Array {
        sortBy(...args) {
            return this.sort(dynamicSortMultiple(...args));
        }
        distinctBy(...props) {
          return this.filter((item, index, arr) =>
            index === arr.findIndex(other =>
              props.every(prop => item[prop] === other[prop])
            )
          );
        }
        filterBy(...args) {
          let props=Object.keys(args[0])
          return this.filter((x)=>{
            return compareProps(x,args[0],props)
          })
        }
        regexBy(...args) {
          let props=Object.keys(args[0])
          return this.filter((x)=>{
            return comparePropsRegex(x,args[0],props)
          })
        }
        selectAttr(...args) {
          let props=Object.keys(args[0])

          return this.map((x)=>{
            let o = {}
            for(let i=0;i<props.length;i++){
              o[props[i]]=x[args[0][props[i]]]
            }
            return o
          })
        }
    }   
    var dummy = fnArray.from([]) // to make it available
    var dummy = fnGetNumberedName([], "###", "") // to make it available
    var dummy = fnToTable([]) // to make it available
    if(expression) 
    return eval(expression)          
  }  

};

export default Helpers;
