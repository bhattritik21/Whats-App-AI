import nodemailer from 'nodemailer';
import * as fs from "fs";

const sendEmail = async (mailID: string) => {
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      auth: {
        user: process.env['MY_EMAIL'],
        pass: process.env['MY_EMAIL_PASS']
      }
    });
  
    const filepath = fs.readFileSync('../example.csv');
    try {
      const info = await transporter.sendMail({
        from: process.env['MY_EMAIL'],
        to: `${mailID}`, // list of receivers
        subject: "Hello here is the reports data✔", // Subject line
        text: `Hello dear,Hope you are doing well, Please find the chats data in the file attached to this email.
    
        Thank you,
        Regards  `, // plain text body
        attachments: [{
          filename: 'example.csv',
          content: filepath
        }]
      });
  
      console.log("Message sent: %s", info.messageId);
      return "Email has been sent successfully";
    }
    catch (err) {
      console.log("Error:", err);
      return "Error while sending the email";
    }
  }

export default sendEmail;