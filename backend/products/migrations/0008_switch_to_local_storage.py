# Generated manually to switch from Cloudinary to local storage

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0007_alter_product_cover_image_alter_product_file'),
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='cover_image',
            field=models.ImageField(blank=True, null=True, upload_to='products/covers/'),
        ),
        migrations.AlterField(
            model_name='product',
            name='file',
            field=models.FileField(blank=True, null=True, upload_to='products/files/'),
        ),
    ]