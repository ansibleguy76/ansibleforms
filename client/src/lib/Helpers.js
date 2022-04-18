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
      return eval("object."+match)
    } else{
      return undefined
    }
  }
};

export default Helpers
