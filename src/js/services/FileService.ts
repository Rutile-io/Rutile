import { Wallet } from '../models/Wallet';
import getConfig from '../Configuration';
const ethers = require('ethers');
const fileDatabaseAbi = require('../../sol/FileDatabase.json');

class FileService {
    static async upload(file: File, wallet: Wallet) {
        const provider = getConfig('provider');
        const address = getConfig('fileDatabaseAddress');
        const contract = new ethers.Contract(address, fileDatabaseAbi, provider);

        console.log(contract);

        const writeResult = await contract.write('QmNt6Mn5wB82N81tYSgbexrfH9PUfcFH6djEa548QCFzU4');

        console.log(writeResult);
        

        const result = await contract.read();

        

        console.log(result);
        
        
    }
}

export default FileService;