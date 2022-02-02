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
  },
  backups(success,error){
    axios.get(`/api/v1/config/backups?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication())                               // load forms
      .then((result)=>{
        var backups=result.data;
        if(!backups.error){
            success(backups)
        }else{
            error(backups.error)
        }
      })
      .catch(function(err){
        if(err.response && err.response.status!=401){
          error("Could not get backups\n\n" + err)
        }
        if(err.response && err.response.status==401){
          error(err)
        }
        if(!err.response){
          error("Could not get backups")
        }
      })
  },
  restore(backupName,success,error){
    axios.post(`/api/v1/config/restore/${backupName}`,TokenStorage.getAuthentication())                               // load forms
      .then((result)=>{
        if(result.data.status=="success"){
          success(result.data.message)
        }else{
          error(result.data.message)
        }
      })
      .catch(function(err){
        if(err.response && err.response.status!=401){
          error("Could not restore\n\n" + err)
        }
        if(err.response && err.response.status==401){
          error(err)
        }
        if(!err.response){
          error("Could not restore")
        }
      })
  }
}


export default Form
