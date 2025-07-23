import axios from 'axios';
import TokenStorage from './TokenStorage';

const Form = {
    async loadAll(){
        try{
            const result = await axios.get(`/api/v1/config?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication()) 
            const formConfig = result.data;
            if(!formConfig.error){
                return formConfig;
            }else{
                throw new Error(formConfig.error);
            }
        }catch(err){
            if(err.response?.status != 401){
                throw new Error(`Could not load the forms.\n\n${err.message}`)
            }
            if(err.response?.status == 401){
                throw new Error(err.message)
            }
            if(!err.response){
                throw new Error(`Could not load the forms.`)
            }   
        }
    },

    async load(name){
        try{
            const result = await axios.get(`/api/v1/config/form?name=${encodeURIComponent(name)}&timestamp=${new Date().getTime()}`, TokenStorage.getAuthentication())
            const formConfig = result.data;
            if(!formConfig.error){
                return formConfig;
            }else{
                throw new Error(formConfig.error);
            }
        }catch(err){
            if(err.response?.status != 401){
                throw new Error(`Could not load the forms.\n\n${err.message}`)
            }
            if(err.response?.status == 401){
                throw new Error(err.message)
            }
            if(!err.response){
                throw new Error(`Could not load the forms.`)
            }   
        }
    },    

    async list(){
        try{
            const result = await axios.get(`/api/v1/config/formlist?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication()) 
            const formConfig = result.data;
            if(!formConfig.error){
                return formConfig;
            }else{
                throw new Error(formConfig.error);
            }
        }catch(err){
            if(err.response?.status != 401){
                throw new Error(`Could not load the forms.\n\n${err.message}`)
            }
            if(err.response?.status == 401){
                throw new Error(err.message)
            }
            if(!err.response){
                throw new Error(`Could not load the forms.`)
            }   
        }
    },

    async save(forms){
        try{
            const result = await axios.post(`/api/v1/config`,{forms},TokenStorage.getAuthentication())
            const formConfig = result.data;
            if(formConfig?.status == "success"){
                return true;
            }
            if(formConfig.data?.error){
                throw new Error(formConfig.data.error);
            }else{
                throw new Error("Unknown error during saving the forms.");
            }
        }catch(err){
            if(err.response?.status != 401){
                throw new Error(`Could not save the forms.\n\n${err.message}`)
            }
            if(err.response?.status == 401){
                throw new Error(err.message)
            }
            if(!err.response){
                throw new Error(`Could not save the forms.`)
            }   
        }
    },
    async validate(forms){
        try{
            const result = await axios.post(`/api/v1/config/check`,{forms},TokenStorage.getAuthentication())
            const formConfig = result.data;
            if(formConfig?.status == "success"){
                return true;
            }
            if(formConfig.data?.error){
                throw new Error(formConfig.data.error);
            }else{
                throw new Error("Unknown error during validating the forms.");
            }
        }catch(err){
            if(err.response?.status != 401){
                throw new Error(`Could not validate the forms.\n\n${err.message}`)
            }
            if(err.response?.status == 401){
                throw new Error(err.message)
            }
            if(!err.response){
                throw new Error(`Could not validate the forms.`)
            }
        }
    },

}

export default Form;