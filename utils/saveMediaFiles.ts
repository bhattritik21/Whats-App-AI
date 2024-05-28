import { Message, WechatyBuilder } from "wechaty";
import * as fs from "fs";

const bot = WechatyBuilder.build({
    puppet: "wechaty-puppet-whatsapp",
});

const saveMediaFiles = async (message: Message) => {
    const fileTypeList = [
        bot.Message.Type.Location,
        bot.Message.Type.Audio,
        bot.Message.Type.Image,
        bot.Message.Type.Video,
        bot.Message.Type.Contact,
        bot.Message.Type.Attachment,
    ]

    //console.info("Media type:", bot.Message.Type);
    var name: string = "";
    if (fileTypeList.includes(message.type())) {
        //console.log(message.type())
        //console.log(fileBox);
        let fileExtension;
        switch (message.type()) {
            case bot.Message.Type.Image:
                console.log("Image")
                fileExtension = 'jpeg';
                name = 'image';
                break;
            case bot.Message.Type.Location:
                console.log("Location")
                fileExtension = 'txt';
                name = 'location';
                break;
            case bot.Message.Type.Audio:
                fileExtension = 'mp3';
                name = 'audio';
                break;
            case bot.Message.Type.Video:
                fileExtension = 'mp4';
                name = 'video';
                break;
            case bot.Message.Type.Contact:
                const lines = message.payload?.text?.split('\n');
                const vcardData: any = message.payload?.text;
                let FNName = '';
                if (lines) {
                    lines?.forEach(line => {
                        if (line.startsWith('FN:')) {
                            FNName = line.substring(3);
                        }
                    });
                    fs.writeFileSync(`./source/Contact/${FNName}.vcf`, vcardData);
                    return;
                }

                break;
            case bot.Message.Type.Attachment:
                name = 'document';
                // fileExtension = 'pdf';
                break;
            default:
                break;
        }

        try {
            const fileBox = await message.toFileBox();
            let filePath = `./source/mediaFiles/${name}.${fileExtension}`;
            if (message.text()) {
                filePath = `./source/mediaFiles/${message.payload?.text}.${fileExtension}`;
            }
            if (message.type() === 1) {
                filePath = `./source/mediaFiles/${fileBox.name}`;
            }
            console.info(`Saving file ${fileBox.name} to ${filePath}...`);
            await fileBox.toFile(filePath, true);
            return;
        }
        catch (err) {
            console.info("Media type not supported", err);
            return;
        }

    }
    else {
        console.info("Media type not supported");
        return;
    }

}

export default saveMediaFiles;