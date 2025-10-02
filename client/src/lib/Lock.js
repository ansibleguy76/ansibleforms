import axios from 'axios';
import TokenStorage from './TokenStorage';

const Lock = {
    async get(){
        try{
            const result = await axios.get(`/api/v1/lock`,TokenStorage.getAuthentication())
            const lock = result.data;
            if(lock?.status == "error" && lock.data?.error?.startsWith("Designer is disabled")){
                throw new Error(lock.data.error);
            }
            if(lock?.status == "error"){
                throw new Error(lock.message);
            }
            return lock.data.output;
        }catch(err){
            throw new Error(`Could not get the lock.\n\n${err.message}`)
        }
    },
    async set(){
        try{
            const result = await axios.post(`/api/v1/lock`,{},TokenStorage.getAuthentication())
            const lock = result.data;
            if(lock?.status == "error"){
                throw new Error("Failed to set lock");
            }
            return true;
        }catch(err){
            throw new Error(`Could not set the lock.\n\n${err.message}`)
        }
    },
    async release(){
        try{
            const result = await axios.delete(`/api/v1/lock`,TokenStorage.getAuthentication())
            const lock = result.data;
            if(lock?.status == "error"){
                throw new Error("Failed to release lock");
            }
            return true;
        }catch(err){
            throw new Error(`Could not release the lock.\n\n${err.message}`)
        }
    }
}

export default Lock;