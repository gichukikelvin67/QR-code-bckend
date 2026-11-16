import { PrismaClient } from "@prisma/client";
import{env}from "./env.js";
const prisma=new PrismaClient({
    log:
    env.NODE_ENV === "development"
    ?["warn","error"]
    :["error"]
})
export default prisma;
//provides one reusable prisma database client through out the application.