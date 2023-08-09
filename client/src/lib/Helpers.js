const inspect = require('util').inspect
var Helpers = {
  htmlEncode(v){
      return v.toString().replace(/[\u00A0-\u9999<>\&]/g, function(i) { //eslint-disable-line
        return '&#'+i.charCodeAt(0)+';';
      });
  },
  findDuplicates(arry){
    return arry.filter((item, index) => arry.indexOf(item) !== index)
  },
  findMissing(needles,haystack){
    if(needles || needles.length>0){
      return haystack.filter(x => !needles.includes(x))
    }else {
      return []
    }
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
  evalSandbox(expression){
    // local autonumbering
    function fnGetNumberedName(names,pattern,value,fillgap=false){
      var nr=null
      var nrsequence
      var regex
      var nrs
      var re=new RegExp("[^\#]*(\#+)[^\#]*") // eslint-disable-line
      var patternmatch=re.exec(pattern)
      if(!names || !Array.isArray(names)){
        console.log("fnGetNumberedName, No input or no array")
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
          console.log("fnGetNumberedName, no pattern matches found in the list")
          return value
        }
      }else{
        console.log("fnGetNumberedName, no pattern found, use ### for numbers")
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
        distinctBy(...args) {
            return this.filter((a, i) => this.findIndex((s) => compareProps(a,s,args)) === i)
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
    return eval(expression)          
  }


};

export default Helpers
