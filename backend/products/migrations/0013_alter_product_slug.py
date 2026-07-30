from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0012_product_slug'),
    ]

    operations = [
        # 280 -> 255 clears the MySQL unique-CharField warning (mysql.W003);
        # slugs are always well under 255 anyway.
        migrations.AlterField(
            model_name='product',
            name='slug',
            field=models.SlugField(max_length=255, unique=True, null=True, blank=True),
        ),
    ]
