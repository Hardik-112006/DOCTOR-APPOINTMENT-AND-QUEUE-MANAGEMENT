from apps.accounts.management.commands.seed_demo import Command as SeedDemoCommand

class Command(SeedDemoCommand):
    help = 'Alias for seed_demo: Seeds database with realistic development data, 8+ doctors, schedules, and test accounts.'
