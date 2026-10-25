const { Kafka, logLevel } = require('kafkajs');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { config } = require('./index');

const isLocalKafka =
     (config.KAFKA_BROKER || '').includes('localhost') ||
     (config.KAFKA_BROKER || '').includes('127.0.0.1');

const kafkaOptions = {
     clientId: config.KAFKA_CLIENT_ID || 'notification-service',
     brokers: [config.KAFKA_BROKER || 'localhost:9093'],
     logLevel: logLevel.ERROR,
     retry: {
          initialRetryTime: 300,
          retries: 10,
          maxRetryTime: 30000,
          multiplier: 2,
     },
};

// Aiven requires TLS and SASL authentication.
if (!isLocalKafka) {
     const caPath = path.resolve(__dirname, '../../certs/ca.pem');
     if (!fs.existsSync(caPath)) {
          throw new Error(
               `Kafka CA certificate not found at ${caPath}. ` +
               'Download the CA certificate from your Aiven console.'
          );
     }

     if (!config.KAFKA_USERNAME || !config.KAFKA_PASSWORD) {
          throw new Error(
               'KAFKA_USERNAME and KAFKA_PASSWORD must be configured.'
          );
     }

     kafkaOptions.ssl = {
          ca: [fs.readFileSync(caPath, 'utf8')],
          rejectUnauthorized: true,
     };

     kafkaOptions.sasl = {
          // Change this if Aiven shows a different SASL mechanism.
          mechanism: config.KAFKA_SASL_MECHANISM || 'scram-sha-256',
          username: config.KAFKA_USERNAME,
          password: config.KAFKA_PASSWORD,
     };
}

const kafka = new Kafka(kafkaOptions);

const consumer = kafka.consumer({
     groupId: 'notification-service-group',
     sessionTimeout: 30000,
     heartbeatInterval: 3000,
});

const producer = kafka.producer({
     allowAutoTopicCreation: false,
     retry: {
          retries: 5,
     },
});

let isProducerConnected = false;
let isConsumerConnected = false;
let isShuttingDown = false;

const connectProducer = async () => {
     if (isProducerConnected) return;

     await producer.connect();
     isProducerConnected = true;

     logger.info('Kafka producer connected successfully');
};

const connectConsumer = async () => {
     if (isConsumerConnected) return;

     await consumer.connect();
     isConsumerConnected = true;

     logger.info('Kafka consumer connected successfully');
};

const shutdown = async () => {
     if (isShuttingDown) return;

     isShuttingDown = true;
     logger.info('Shutting down Kafka connections...');

     try {
          if (isConsumerConnected) {
               await consumer.disconnect();
               isConsumerConnected = false;
          }

          if (isProducerConnected) {
               await producer.disconnect();
               isProducerConnected = false;
          }

          logger.info('Kafka connections closed successfully');
          process.exitCode = 0;
     } catch (error) {
          logger.error('Error shutting down Kafka connections', {
               error: error.message,
          });

          process.exitCode = 1;
     }
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

module.exports = {
     kafka,
     consumer,
     producer,
     connectProducer,
     connectConsumer,
     shutdown,
};