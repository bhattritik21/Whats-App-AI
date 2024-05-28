import "dotenv/config.js";
import { config } from "dotenv";
config();
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
import { FileBox } from "file-box";
import sendEmail from "./utils/mail.ts";
import getContact from "./utils/getContact.ts";
import setContact from "./utils/setContact.ts";

const clientdb = new MongoClient(process.env['MONGO_URI'] || "", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
let db;
let collection;

async function initDb() {
  await clientdb.connect();
  db = clientdb.db("Bot");
  collection = db.collection("Cluster0");
}

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
  azureOpenAIBasePath: "https://super-open-ai-east.openai.azure.com/openai/deployments/superai-35-turbo-16k/chat/completions?api-version=2024-02-15-preview",
});

let globalVectorStore;

async function setupVectorStore() {
  globalVectorStore = new MongoDBAtlasVectorSearch(openAIEmbeddings, dbConfig);
}

const findContact = async (id) => {
  const contactPayload = await bot.Contact.find({ id });
  return contactPayload?.payload?.name || "";
}

const findOwner = async (id) => {
  const roomPayload = await bot.Room.find({ id });
  const roomOwnerID = roomPayload?.payload?.ownerId;
  return findContact(roomOwnerID);
}

const answerQuestion = async (question, message) => {
  try {
    const retriever = globalVectorStore.asRetriever({
      k: 50,
      filter: { preFilter: { "room": message?.payload?.roomId } },
    });
    const retrievedResults = await retriever.getRelevantDocuments(question);
    const documents = retrievedResults.map((doc) => ({
      chat: doc.pageContent,
      user: doc.metadata['User'],
      owner: doc.metadata['owner'],
    }));

    const parser = new StringOutputParser();
    const promptData = fs.readFileSync('prompt.txt', 'utf-8');
    const prompt = ChatPromptTemplate.fromTemplate(promptData);

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

    return JSON.stringify(result.answer);
  } catch (error) {
    console.error("Error getting answer", error);
    return "";
  }
}

function onScan(qrcode, status) {
  if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
    const qrcodeImageUrl = `https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`;
    console.log("StarterBot", "onScan: %s(%s) - %s", ScanStatus[status], status, qrcodeImageUrl);
    qrcodeTerminal.generate(qrcode, { small: true });
  } else {
    console.log("StarterBot", "onScan: %s(%s)", ScanStatus[status], status);
  }
}

function onLogin(user) {
  console.log("StarterBot", "%s login", user);
}

function onLogout(user) {
  console.log("StarterBot", "%s logout", user);
}

async function onMessage(message) {
  if (!message.payload?.roomId || (message.payload.roomId !== "120363274635665018@g.us" && message.payload.roomId !== "120363274628778011@g.us")) {
    return;
  }

  const text = message.text().toLowerCase();
  let receivedMessage = message.text();
  const superRegex = /@super/;
  const emailRegex = /send an email of sales report to/g;
  const regexGetContact = /get contact of ([^\s]+)/i;
  const regexSetContact = /set contact - ([^,]+), \+?(\d[\d\s]+)\b/i;

  if (superRegex.test(text)) {
    receivedMessage = receivedMessage.replace(/@super/g, "");
    if (emailRegex.test(receivedMessage.toLowerCase())) {
      const emailID = receivedMessage.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)[0];
      const emailSent = await sendEmail(emailID);
      await message.say(emailSent);
      return;
    } else if (regexGetContact.test(receivedMessage.toLowerCase())) {
      const getContactMatch = receivedMessage.match(regexGetContact);
      const reply = getContact(getContactMatch);
      await message.say(reply);
      return;
    } else if (regexSetContact.test(receivedMessage.toLowerCase())) {
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
    owner = 'ritik';
  }
  console.log("User:" + user, "Owner:" + owner);
  const currTime = new Date();
  const year = currTime.getFullYear();
  const month = currTime.getMonth() + 1;
  const day = currTime.getDate();
  const time = `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;

  const modifiedMessage = user ? `${user} says ${chat}` : `${userID} says ${chat}`;
  if (!superRegex.test(text) && userID !== '916395161369@c.us') {
    const csvLine = `${time},${user},${modifiedMessage},${roomID},${owner}\n`;
    fs.appendFile("example.csv", csvLine, "utf-8", (err) => {
      if (err) {
        console.error('Error appending to file:', err);
      } else {
        console.log('Successfully appended to file');
      }
    });
  }

  try {
    if (!superRegex.test(text) && userID !== '916395161369@c.us') {
      const data = await collection.findOne({ "room": roomID, "timeStamp": time, "User": user });
      if (data) {
        const newText = `${data['text']}\n${modifiedMessage}`;
        await collection.updateOne(
          { "room": roomID, "timeStamp": time, "User": user },
          { $set: { "text": newText } }
        );
      } else {
        const docs = [{
          pageContent: modifiedMessage,
          metadata: {
            User: user,
            timeStamp: time,
            room: roomID,
            owner: owner
          }
        }];

        const vectorStore = await MongoDBAtlasVectorSearch.fromDocuments(docs, openAIEmbeddings, dbConfig);
        globalVectorStore = vectorStore;
      }
    }
    if (superRegex.test(text)) {
      console.log("Message contains @super tag. Processing...");
      const reply = await answerQuestion(chat, message);
      console.log(reply);
      if (reply) {
        let ans = reply.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/"/g, '');
        await message.say(ans);
      }
    } else {
      console.log("Message does not contain @super tag. Skipping...");
    }
  } catch (err) {
    console.error(err);
  }
}

const bot = WechatyBuilder.build({
  puppet: "wechaty-puppet-whatsapp",
});

(async () => {
  try {
    await initDb();
    await setupVectorStore();

    bot.on("scan", onScan);
    bot.on("login", onLogin);
    bot.on("logout", onLogout);
    bot.on("message", onMessage);

    await bot.start();
    console.log("StarterBot", "Starter Bot Started.");
  } catch (error) {
    console.error(error);
  }
})();
