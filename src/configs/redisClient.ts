import { createClient } from "redis";

const redisClient = createClient({
    url: process.env.REDIS_URL,
})

redisClient.on("error", (error) => {
    console.error("Redis connection error:", error);
});

redisClient.on("connect", () => {
    console.log("Redis connected");
});

export default redisClient;
