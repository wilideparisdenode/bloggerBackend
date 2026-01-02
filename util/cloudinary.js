import { v2 as cloudinary } from 'cloudinary';
import dns from 'dns';
import { config } from 'dotenv';

config();

// Validate environment variables
const requiredEnvVars = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn(`⚠️ Missing required environment variables: ${missingVars.join(', ')}`);
  console.warn('⚠️ Cloudinary functionality will be disabled');
 
} else {
  console.log('All required Cloudinary environment variables are loaded.');
}

// Configure Cloudinary with retry options and custom DNS settings
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 60000,
  retry: {
    max_retries: 3,
    retry_delay: 1000
  },
  api_proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
  api_host: 'api.cloudinary.com',
  api_port: 443
});

// Test DNS resolution
const testDNSResolution = async () => {
  return new Promise((resolve, reject) => {
    dns.lookup('api.cloudinary.com', (err, address, family) => {
      if (err) {
        console.error('DNS resolution failed:', err);
        reject(err);
      } else {
        console.log(`DNS resolution successful: ${address} (IPv${family})`);
        resolve(address);
      }
    });
  });
};

// Test Cloudinary connection with retry logic
const testCloudinaryConnection = async (retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await testDNSResolution();
      const result = await cloudinary.api.ping();
      console.log('✅ Cloudinary connection test successful:', result);
      return true;
    } catch (error) {
      console.warn(`⚠️ Cloudinary connection attempt ${i + 1}/${retries} failed:`, {
        error: error.message,
        code: error.http_code,
        name: error.name
      });
      
      if (i < retries - 1) {
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('❌ All Cloudinary connection attempts failed');
  return false;
};

// Initialize Cloudinary connection
let cloudinaryReady = false;
testCloudinaryConnection().then(success => {
  cloudinaryReady = success;
}).catch(error => {
  console.error('Failed to initialize Cloudinary:', error);
});

export { cloudinary, cloudinaryReady };