import axios from 'axios'
import TokenStorage from './TokenStorage'
var Form = {

  load(success,error){
    axios.get(`/api/v1/config?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication())                               // load forms
      .then((result)=>{
        var formConfig=result.data;
        if(!formConfig.error){
            success(formConfig)
        }else{
            error(formConfig.error)
        }
      })
      .catch(function(err){
        if(err.response && err.response.status!=401){
          error("Could not get forms.yaml file\n\n" + err)
        }
        if(err.response && err.response.status==401){
          error(err)
        }
        if(!err.response){
          error("Could not get forms.yaml file")
        }
      })
  }
};

export default Form
