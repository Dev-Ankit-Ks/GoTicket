const { Kafka, logLevel } = require('kafkajs');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { config } = require('.');

const caPath = path.resolve(process.cwd(), 'certs', 'ca.pem');

if (!config.KAFKA_BROKER) {
     throw new Error('KAFKA_BROKER is missing');
}

if (!config.KAFKA_USERNAME || !config.KAFKA_PASSWORD) {
     throw new Error('Kafka SASL credentials are missing');
}

if (!fs.existsSync(caPath)) {
     throw new Error(`Kafka CA certificate not found: ${caPath}`);
}

const kafka = new Kafka({
     clientId: config.KAFKA_CLIENT_ID || 'my-node-app',

     brokers: [config.KAFKA_BROKER],

     // Trust the CA certificate provided by Aiven
     ssl: {
          ca: [fs.readFileSync(caPath, 'utf8')],
     },

     sasl: {
          mechanism: 'scram-sha-256',
          username: config.KAFKA_USERNAME,
          password: config.KAFKA_PASSWORD,
     },

     logLevel: logLevel.ERROR,

     retry: {
          initialRetryTime: 300,
          retries: 8,
          maxRetryTime: 30000,
     },
});

const producer = kafka.producer({
     allowAutoTopicCreation: true,
     transactionTimeout: 30000,
     idempotent: true,
     maxInFlightRequests: 5,
     retry: {
          retries: 5,
     },
});

let isConnected = false;
let connectionPromise = null;

const connectProducer = async () => {
     if (isConnected) return;

     if (connectionPromise) {
          return connectionPromise;
     }

     connectionPromise = (async () => {
          try {
               await producer.connect();
               isConnected = true;
               logger.info('Kafka producer connected successfully');
          } catch (error) {
               const message =
                    error instanceof Error ? error.message : String(error);

               logger.error(`Kafka producer connection failed: ${message}`);
               throw error;
          } finally {
               connectionPromise = null;
          }
     })();

     return connectionPromise;
};

const disconnectProducer = async () => {
     if (!isConnected) return;

     await producer.disconnect();
     isConnected = false;

     logger.info('Kafka producer disconnected');
};

module.exports = {
     kafka,
     producer,
     connectProducer,
     disconnectProducer,
};