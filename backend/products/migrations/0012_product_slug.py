from django.db import migrations, models
from django.utils.text import slugify


def generate_slugs(apps, schema_editor):
    """Backfill a unique slug for every existing product."""
    Product = apps.get_model('products', 'Product')
    for product in Product.objects.all().order_by('id'):
        base = (slugify(product.title) or 'product')[:250]
        slug = base
        n = 2
        while Product.objects.filter(slug=slug).exclude(pk=product.pk).exists():
            suffix = f"-{n}"
            slug = f"{base[:250 - len(suffix)]}{suffix}"
            n += 1
        product.slug = slug
        product.save(update_fields=['slug'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0011_alter_tickettier_options_and_more'),
    ]

    operations = [
        # 1) add the column nullable + non-unique so existing rows are allowed
        migrations.AddField(
            model_name='product',
            name='slug',
            field=models.SlugField(max_length=280, null=True, blank=True),
        ),
        # 2) fill in unique slugs for the rows that already exist
        migrations.RunPython(generate_slugs, noop),
        # 3) now that every row has one, enforce uniqueness
        migrations.AlterField(
            model_name='product',
            name='slug',
            field=models.SlugField(max_length=280, unique=True, null=True, blank=True),
        ),
    ]
