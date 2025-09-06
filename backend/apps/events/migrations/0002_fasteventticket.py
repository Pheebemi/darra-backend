# Generated migration for FastEventTicket model

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0001_initial'),
        ('payments', '0001_initial'),
        ('products', '0001_initial'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='FastEventTicket',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ticket_id', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('quantity', models.PositiveIntegerField(default=1)),
                ('ticket_png', models.ImageField(blank=True, null=True, upload_to='tickets/png/')),
                ('ticket_png_path', models.CharField(blank=True, max_length=500, null=True)),
                ('qr_code', models.ImageField(blank=True, null=True, upload_to='tickets/qr_codes/')),
                ('qr_code_path', models.CharField(blank=True, max_length=500, null=True)),
                ('is_used', models.BooleanField(default=False)),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('buyer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fast_purchased_tickets', to='users.user')),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fast_tickets', to='products.product')),
                ('purchase', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fast_tickets', to='payments.purchase')),
                ('verified_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='verified_fast_tickets', to='users.user')),
            ],
            options={
                'verbose_name': 'Fast Event Ticket',
                'verbose_name_plural': 'Fast Event Tickets',
                'ordering': ['-created_at'],
            },
        ),
    ]
