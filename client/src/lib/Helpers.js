var Helpers = {
  htmlEncode(v){
      return v.toString().replace(/[\u00A0-\u9999<>\&]/g, function(i) { //eslint-disable-line
        return '&#'+i.charCodeAt(0)+';';
      });
  },
};

export default Helpers
