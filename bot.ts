import "dotenv/config.js";
import { config } from "dotenv";
config();
//import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { Contact, Message, ScanStatus, WechatyBuilder, log } from "wechaty";
import qrcodeTerminal from "qrcode-terminal";
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as fs from "fs";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as path from 'path';
import { FileBox } from "file-box";
import sendEmail from "./utils/mail.ts";
import getContact from "./utils/getContact.ts";
import setContact from "./utils/setContact.ts";

const clientdb = new MongoClient(process.env['MONGO_URI'] || "");
// const database = clientdb.db("super-llm");
// const collection = database.collection("whatsapp_conversation");
const database = clientdb.db("Bot");
const collection = database.collection("Cluster0");

const dbConfig = {
  collection: collection,
  indexName: "vector_index",
  textKey: "text",
  embeddingKey: "embedding",
};

const openAIEmbeddings = new OpenAIEmbeddings({
  batchSize: 512,
  dimensions: 1536,
  modelName: "text-embedding-3-large",
  azureOpenAIApiKey: process.env['AZURE_OPENAI_API_KEY'],
  azureOpenAIApiVersion: process.env['AZURE_OPENAI_API_VERSION'],
  azureOpenAIApiInstanceName: process.env['AZURE_OPENAI_API_INSTANCE_NAME'],
  azureOpenAIApiDeploymentName: process.env['AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME'],
  azureOpenAIBasePath: process.env['AZURE_OPENAI_BASE_PATH'],
});

const model = new ChatOpenAI({
  temperature: 0.8,
  azureOpenAIApiKey: process.env['AZURE_OPENAI_API_KEY'],
  azureOpenAIApiVersion: "2024-02-15-preview",
  azureOpenAIApiInstanceName: "super-open-ai-east",
  azureOpenAIApiDeploymentName: "superai-35-turbo-16k",
  azureOpenAIBasePath:
    "https://super-open-ai-east.openai.azure.com/openai/deployments/superai-35-turbo-16k/chat/completions?api-version=2024-02-15-preview",
});

let golbalVectorStore = new MongoDBAtlasVectorSearch(
  openAIEmbeddings,
  dbConfig
);

const findContact = async (id: string) => {
  const contactPayload: any = await bot.Contact.find({ id })
  const contactName: string = contactPayload?.payload?.name;
  //console.log("Contact", contactName);
  return contactName;
}

const findOwner = async (id: string) => {
  const roomPayload: any = await bot.Room.find({ id })
  const roomOwnerID: string = roomPayload?.payload?.ownerId;
  const roomOwner = await findContact(roomOwnerID);
  //console.log("Owner", roomOwner);
  return roomOwner;
}

const answerQuestion = async (question: string, message: Message) => {
  try {
    console.log(message);
    const retriever = golbalVectorStore.asRetriever({ k: 50, filter: { preFilter: { "room": message?.payload?.roomId } }, });
    // const retriever = golbalVectorStore.asRetriever({ k: 6, filter: { preFilter: { "owner": { "$eq": "prynce" } } }, });
    const retrievedResults = await retriever.getRelevantDocuments(question);
    const documents = retrievedResults.map((documents) => ({
      chat: documents.pageContent,
      user: documents.metadata['User'],
      owner: documents.metadata['owner'],
    }));

    console.log(documents);

    const parser = new StringOutputParser();
    const promptData = fs.readFileSync('prompt.txt', 'utf-8');
    //console.log(promptData);
    const promptTemplate = `${promptData}`;

    const prompt = ChatPromptTemplate.fromTemplate(promptTemplate);

    const documentChain = await createStuffDocumentsChain({
      llm: model,
      prompt,
      outputParser: parser,
    });

    const retrievalChain = await createRetrievalChain({
      combineDocsChain: documentChain,
      retriever,
    });

    const result = await retrievalChain.invoke({
      input: question,
      context: retrievedResults,
    });

    const answer = JSON.stringify(result.answer);
    console.log("Answer: " + answer);
    return answer;
  } catch (error) {
    console.error("Error getting answer", error);
    return "";
  }
}

function onScan(qrcode: string, status: ScanStatus) {
  if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
    const qrcodeImageUrl = [
      "https://wechaty.js.org/qrcode/",
      encodeURIComponent(qrcode),
    ].join("");
    console.log(
      "StarterBot",
      "onScan: %s(%s) - %s",
      ScanStatus[status],
      status,
      qrcodeImageUrl
    );

    qrcodeTerminal.generate(qrcode, { small: true });
  } else {
    console.log("StarterBot", "onScan: %s(%s)", ScanStatus[status], status);
  }
}

function onLogin(user: Contact) {
  console.log("StarterBot", "%s login", user);
  setTimeout(() => {
    console.log("StarterBot");
  }, 3000);
}

function onLogout(user: Contact) {
  console.log("StarterBot", "%s logout", user);
}

async function onMessage(message: Message) {
  if (!message.payload?.roomId || (message.payload.roomId != "120363274635665018@g.us" &&
    message.payload.roomId != "120363274628778011@g.us")) {
    return;
  }

  console.log("StarterBot got a message", message);
  const text: string = message.text().toLowerCase();

  var receivedMessage: string = message.text();
  const superRegex = /@super/;
  const emailRegex = /send an email of sales report to/g;
  const regexGetContact = /get contact of ([^\s]+)/i;
  const regexSetContact = /set contact - ([^,]+), \+?(\d[\d\s]+)\b/i;

  if (superRegex.test(text)) {
    receivedMessage = receivedMessage.replace(/@super/g, "");
     if (emailRegex.test(receivedMessage.toLowerCase())) {
      const emaiIDRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const emailID: any = receivedMessage.match(emaiIDRegex);
      const emailSent: string = await sendEmail(emailID[0]);
      await message.say(emailSent);
      return;
    }
    else if (regexGetContact.test(receivedMessage.toLowerCase())) {
      const getContactMatch = receivedMessage.match(regexGetContact);
      const reply = getContact(getContactMatch);
      await message.say(reply);
      return;
    }
    else if (regexSetContact.test(receivedMessage.toLowerCase())) {
      const setContactMatch = receivedMessage.match(regexSetContact);
      const reply = setContact(setContactMatch);
      await message.say(reply);
      return;
    }
  }

  const chat = receivedMessage;
  const roomID = message.payload.roomId;
  const userID = message.payload.talkerId;
  const user = await findContact(userID);
  let owner = await findOwner(roomID);
  if (roomID === '120363274635665018@g.us') {
    owner = 'ritik'
  }
  console.log("User:" + user, "Owner:" + owner);
  const currTime = new Date();
  const year = currTime.getFullYear();
  const month = currTime.getMonth() + 1;
  const day = currTime.getDate();
  const time = `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;

  const modifiedMessage = user ? `${user} says ${chat}` : `${userID} says ${chat}`;
  if (!superRegex.test(text) && userID != '916395161369@c.us') {
    const csvLine = `${time},${user},${modifiedMessage},${roomID},${owner}\n`;
    fs.appendFileSync("example.csv", csvLine, "utf-8");
  }
  await clientdb.connect();

  try {
    if (!superRegex.test(text)&& userID != '916395161369@c.us') {
      const data = await collection.findOne({ "room": roomID, "timeStamp": time ,"User": user});
      if (data) {
        const newText = data['text'] + "\n" + modifiedMessage;
        await collection.updateOne(
          { "room": roomID, "timeStamp": time, "User": user},
          {$set: { "text": newText }}
      );
      }
      else {
        const docs = [{
          pageContent: modifiedMessage,
          metadata: {
            User: user,
            timeStamp: time,
            room: roomID,
            owner: owner
          }
        }];

        const vectorStore = await MongoDBAtlasVectorSearch.fromDocuments(
          docs,
          openAIEmbeddings,
          dbConfig
        );

        golbalVectorStore = vectorStore;
      }

     
    }
    if(superRegex.test(text)) {
      console.log("Message contains @super tag. Processing...");
      const reply = await answerQuestion(chat, message);
      console.log(reply);
      if (reply) {
        let ans = reply.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/"/g, '');;
        await message.say(ans);
      }
    }
    else{
      console.log("Message does not contain @super tag. Skipping...");
    }
  } 
  catch(err){
  console.log(err);
  }
  finally {
   // await clientdb.close();
  }
}

const bot = WechatyBuilder.build({
  puppet: "wechaty-puppet-whatsapp",
});

try {
  bot.on("scan", onScan);
  bot.on("login", async (user: Contact) => {
    onLogin(user);
  });
  bot.on("logout", onLogout);
  bot.on("message", onMessage);

  bot
    .start()
    .then(() => console.log("StarterBot", "Starter Bot Started."))
    .catch((e) => log.error("StarterBot", e));
} catch (error: any) {
  console.log(error);
}
