import { FileBox } from "file-box";
import * as fs from "fs";
import * as path from 'path';

const getContact = (contactDetails: any) => {
    try {
      const contactName = contactDetails[1];
      const files = fs.readdirSync('./source/Contact').filter(file => file.toLowerCase().includes(contactName.toLowerCase()));
      if (files.length > 0) {
        const file = files[0];
        if (file) {
          const filePath = path.join('./source/Contact', file);
          const fileBuffer = fs.readFileSync(filePath);
          const base64String = fileBuffer.toString('base64');
          const fileBox = FileBox.fromBase64(base64String, filePath);
          return fileBox;
        }
        else {
          return `Sorry, I couldn't find any contact with name ${contactName} file.`;
        }
      }
      else {
        return `Sorry, I couldn't find any contact with name ${contactName} file.`;
      }
    } catch (err) {
      console.log("Error:" + err);
      return "There was an error while finding the the contact."
    }
  
  }

  export default getContact;