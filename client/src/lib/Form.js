import axios from 'axios'
import TokenStorage from './TokenStorage'
var Form = {

  load(success,error){
    axios.get(`${process.env.BASE_URL}api/v1/config?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication())                               // load forms
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
          error("Could not get forms.yaml file\n\n" + err.toString())
        }
        if(err.response && err.response.status==401){
          error(err)
        }
        if(!err.response){
          error("Could not get forms.yaml file")
        }
      })
  },
  // list is same as load but /config/list is used for the route
  async getList(success,error){
    try{
      var result = await axios.get(`${process.env.BASE_URL}api/v1/config/formlist?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication())                               // load forms
      var formConfig=result.data;
      if(!formConfig.error){
          success(formConfig)
      }
      if(formConfig.error){
          error(formConfig.error)
      }
    }catch(err){
      if(err.response && err.response.status!=401){
        error("Could not get forms.yaml file\n\n" + err.toString())
      }
      if(err.response && err.response.status==401){
        error(err)
      }
      if(!err.response){
        error("Could not get forms.yaml file")
      }
    }
  },
  // list is same as load but /config/list is used for the route
  async getForm(name,success,error){
    try{
      var result = await axios.get(`${process.env.BASE_URL}api/v1/config/form?timestamp=${new Date().getTime()}&name=${encodeURI(name)}`,TokenStorage.getAuthentication())                               // load forms
      var formConfig=result.data;
      if(!formConfig.error){
          success(formConfig)
      }
      if(formConfig.error){
          error(formConfig.error)
      }
    }catch(err){
      if(err.response && err.response.status!=401){
        error("Could not get forms.yaml file\n\n" + err.toString())
      }
      if(err.response && err.response.status==401){
        error(err)
      }
      if(!err.response){
        error("Could not get forms.yaml file")
      }
    }
  },

  backups(success,error){
    axios.get(`${process.env.BASE_URL}api/v1/config/backups?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication())                               // load forms
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
          error("Could not get backups\n\n" + err.toString())
        }
        if(err.response && err.response.status==401){
          error(err)
        }
        if(!err.response){
          error("Could not get backups")
        }
      })
  },
  restore(backupName,backupBeforeRestore,success,error){
    axios.post(`${process.env.BASE_URL}api/v1/config/restore/${backupName}?backupBeforeRestore=${backupBeforeRestore}`,TokenStorage.getAuthentication())                               // load forms
      .then((result)=>{
        if(result.data.status=="success"){
          success(result.data.message)
        }else{
          error(result.data.message)
        }
      })
      .catch(function(err){
        if(err.response && err.response.status!=401){
          error("Could not restore\n\n" + err.toString())
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
