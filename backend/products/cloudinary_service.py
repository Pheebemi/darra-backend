import cloudinary
import cloudinary.uploader
import cloudinary.api
from django.conf import settings
from django.core.files.base import ContentFile
import os
from typing import Optional, Dict, Any

class CloudinaryService:
    """Service for handling Cloudinary file operations"""
    
    def __init__(self):
        # Configure Cloudinary
        cloudinary.config(
            cloud_name=settings.CLOUDINARY['cloud_name'],
            api_key=settings.CLOUDINARY['api_key'],
            api_secret=settings.CLOUDINARY['api_secret'],
            secure=settings.CLOUDINARY['secure']
        )
    
    def upload_file(self, file, folder: str = "products", public_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Upload a file to Cloudinary
        
        Args:
            file: File object to upload
            folder: Cloudinary folder to store the file
            public_id: Custom public ID for the file
            
        Returns:
            Dict containing upload response from Cloudinary
        """
        try:
            # Prepare upload options
            upload_options = {
                'folder': folder,
                'resource_type': 'auto',  # Auto-detect file type
                'use_filename': True,
                'unique_filename': True,
            }
            
            if public_id:
                upload_options['public_id'] = public_id
            
            # Upload file
            result = cloudinary.uploader.upload(
                file,
                **upload_options
            )
            
            print(f"✅ File uploaded successfully to Cloudinary: {result['public_id']}")
            return result
            
        except Exception as e:
            print(f"❌ Error uploading file to Cloudinary: {str(e)}")
            raise e
    
    def upload_product_file(self, file, product_type: str, product_id: int) -> Dict[str, Any]:
        """
        Upload a product file to Cloudinary with proper organization
        
        Args:
            file: File object to upload
            product_type: Type of product (pdf, mp3, docx, png, zip, video)
            product_id: ID of the product
            
        Returns:
            Dict containing upload response from Cloudinary
        """
        folder = f"products/{product_type}/{product_id}"
        public_id = f"product_{product_id}_{product_type}"
        
        return self.upload_file(file, folder=folder, public_id=public_id)
    
    def upload_cover_image(self, file, product_id: int) -> Dict[str, Any]:
        """
        Upload a product cover image to Cloudinary
        
        Args:
            file: Image file to upload
            product_id: ID of the product
            
        Returns:
            Dict containing upload response from Cloudinary
        """
        folder = f"products/covers/{product_id}"
        public_id = f"cover_{product_id}"
        
        return self.upload_file(file, folder=folder, public_id=public_id)
    
    def delete_file(self, public_id: str) -> bool:
        """
        Delete a file from Cloudinary
        
        Args:
            public_id: Public ID of the file to delete
            
        Returns:
            True if deletion was successful, False otherwise
        """
        try:
            result = cloudinary.uploader.destroy(public_id)
            if result.get('result') == 'ok':
                print(f"✅ File deleted successfully from Cloudinary: {public_id}")
                return True
            else:
                print(f"⚠️ File deletion failed: {result}")
                return False
                
        except Exception as e:
            print(f"❌ Error deleting file from Cloudinary: {str(e)}")
            return False
    
    def get_file_url(self, public_id: str, transformation: Optional[str] = None) -> str:
        """
        Get the URL for a file stored in Cloudinary
        
        Args:
            public_id: Public ID of the file
            transformation: Optional transformation string (e.g., 'w_300,h_200,c_fill')
            
        Returns:
            URL of the file
        """
        if transformation:
            return cloudinary.CloudinaryImage(public_id).build_url(transformation=transformation)
        else:
            return cloudinary.CloudinaryImage(public_id).build_url()
    
    def optimize_file(self, public_id: str, quality: str = 'auto', format: str = 'auto') -> str:
        """
        Get an optimized version of a file
        
        Args:
            public_id: Public ID of the file
            quality: Quality setting ('auto', 'low', 'medium', 'high')
            format: Format to convert to ('auto', 'jpg', 'png', 'webp', etc.)
            
        Returns:
            Optimized file URL
        """
        transformation = f"q_{quality},f_{format}"
        return self.get_file_url(public_id, transformation=transformation)
    
    def generate_thumbnail(self, public_id: str, width: int = 300, height: int = 300) -> str:
        """
        Generate a thumbnail for an image
        
        Args:
            public_id: Public ID of the image
            width: Width of thumbnail
            height: Height of thumbnail
            
        Returns:
            Thumbnail URL
        """
        transformation = f"w_{width},h_{height},c_fill,g_auto"
        return self.get_file_url(public_id, transformation=transformation)

# Create a global instance
cloudinary_service = CloudinaryService()
