import axios from 'axios';
import TokenStorage from './TokenStorage';

const Backup = {
    async load(){
        try{
            const result = await axios.get(`/api/v1/config/backups?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication())
            return result.data;
        }catch(err){
            if(err.response?.status != 401){
                throw new Error(`Could not get the backups.\n\n${err.message}`)
            }
            if(err.response?.status == 401){
                throw new Error(err.message)
            }
            if(!err.response){
                throw new Error(`Could not get the backups.`)
            }
        }
    },
    async restore(backupName,backupBeforeRestore){
        try{
            const result = await axios.post(`/api/v1/config/restore/${backupName}?backupBeforeRestore=${backupBeforeRestore}`,{},TokenStorage.getAuthentication())
            const restore = result.data;
            if(restore?.status == "error"){
                throw new Error(restore.message);
            }
            return true;
        }catch(err){
            if(err.response?.status != 401){
                throw new Error(`Could not restore the backup.\n\n${err.message}`)
            }
            if(err.response?.status == 401){
                throw new Error(err.message)
            }
            if(!err.response){
                throw new Error(`Could not restore the backup.`)
            }
        }
    }
}

export default Backup;