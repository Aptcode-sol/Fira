const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer memory storage (files stored in buffer)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Upload buffer to Cloudinary
const uploadToCloudinary = (buffer, folder = 'events') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `fira/${folder}`,
                resource_type: 'image',
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );

        // Create readable stream from buffer
        const readableStream = new Readable();
        readableStream.push(buffer);
        readableStream.push(null);
        readableStream.pipe(uploadStream);
    });
};

// Upload single image
const uploadSingle = async (file, folder = 'events') => {
    const result = await uploadToCloudinary(file.buffer, folder);
    return {
        url: result.secure_url,
        publicId: result.public_id,
    };
};

// Upload multiple images
const uploadMultiple = async (files, folder = 'events') => {
    const uploadPromises = files.map(file => uploadToCloudinary(file.buffer, folder));
    const results = await Promise.all(uploadPromises);

    return results.map(result => ({
        url: result.secure_url,
        publicId: result.public_id,
    }));
};

// Delete image from Cloudinary
const deleteImage = async (publicId) => {
    try {
        await cloudinary.uploader.destroy(publicId);
        return { success: true };
    } catch (error) {
        console.error('Error deleting image:', error);
        throw error;
    }
};

module.exports = {
    upload,
    uploadSingle,
    uploadMultiple,
    deleteImage,
};
