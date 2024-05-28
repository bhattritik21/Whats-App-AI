import * as path from 'path';
import { FileBox } from "file-box";
import { Message } from "wechaty";
import * as fs from "fs";

const sendNonTextFiles = async (message: Message) => {
  const text = message.text().toLowerCase();

  var fileExtension = '';
  var name = 'image';

  if (text.includes("image")) {
    fileExtension = 'jpeg';
    name = 'image';
  } else if (text.includes("audio")) {
    fileExtension = 'mp3';
    name = 'audio';
  } else if (text.includes("video")) {
    fileExtension = 'mp4';
    name = 'video';
  }
  else if (text.includes("document")) {
    name = 'document';
  } else if (text.includes("contact")) {
    name = 'contact';
  }

  if (name === 'document' || name === 'contact') {
    const files = fs.readdirSync('./source/mediaFiles').filter(file => {
      const extIndex = file.lastIndexOf('.');
      if (extIndex !== -1) {
        const ext = file.substring(extIndex + 1).toLowerCase();
        return name === 'document'
          ? !['mp3', 'mp4', 'jpeg', 'vcf'].includes(ext)
          : ext === 'vcf';
      }
      return false;
    });

    if (files.length > 0) {
      const file = files[0];
      try {
        if (file) {
          const filePath = path.join('./source/mediaFiles', file);
          const fileBuffer = fs.readFileSync(filePath);
          const base64String = fileBuffer.toString('base64');
          const fileBox = FileBox.fromBase64(base64String, filePath);
          await message.say(fileBox);
        }
      } catch (err) {
        console.error("Error:", err);
      }
    } else {
      await message.say(`Sorry, I couldn't find any ${name} file.`);
      return;
    }
  }
  else {
    const file = fs.readdirSync('./source/mediaFiles').filter(file => file.toLowerCase().includes(name) && file.toLowerCase().endsWith(`.${fileExtension}`));
    //console.log("FilePath:" + filePath);
    console.log("FilePath:" + file);
    if (file.length > 0) {
      const media = file[0];
      if (media) {
        try {
          const filePath = path.join('./source/mediaFiles', media);
          console.log(filePath);
          const fileBuffer = fs.readFileSync(filePath);
          if (name === 'video') {
            debugger;
            try {
              const fileBuffer = fs.readFileSync(filePath);
              const fileBox = FileBox.fromBuffer(fileBuffer, 'video.mp4');
              const stream = await fileBox.toStream();
              let base64Data = '';
              stream.on('data', (chunk) => {
                base64Data += chunk.toString('base64');
              });
              stream.on('end', () => {
                const base64FileBox = FileBox.fromBase64(base64Data, 'video.mp4');
                console.log(base64FileBox);
              });
              return;
            }
            catch (err) {
              await message.say(`Sorry, I couldn't find any "${name}".`);
              return;
            }
          }
          else {
            const base64String = fileBuffer.toString('base64');
            const fileBox = FileBox.fromBase64(base64String, filePath);
            await message.say(fileBox);
            return;
          }
        }
        catch (err) {
          console.log("Error:", err);
          await message.say(`Sorry, I couldn't find any "${name}".`);
          return;
        }

      } else {
        await message.say(`Sorry, I couldn't find any "${name}".`);
        return;
      }
    } else {
      await message.say(`Sorry, I couldn't find any "${name}".`);
      return;
    }
  }

}

export default sendNonTextFiles;