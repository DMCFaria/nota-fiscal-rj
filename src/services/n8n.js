import axios from "axios";


const n8n = axios.create({
  baseURL: "https://nfsefedcorp-reese.ngrok-free.dev/",

});

export default n8n;