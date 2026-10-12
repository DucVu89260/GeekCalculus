<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Rules\PasswordByteLimit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class CreateUser extends Command
{
    protected $signature = 'app:create-user {email} {--name=} {--role=user}';

    protected $description = 'Create a local user; password is entered privately, never seeded.';

    public function handle(): int
    {
        $password = $this->secret('Password (at least 12 characters)');
        $data = ['email' => $this->argument('email'), 'name' => $this->option('name') ?: $this->argument('email'), 'role' => $this->option('role'), 'password' => $password];
        $v = Validator::make($data, ['email' => 'required|email|unique:users,email', 'name' => 'required|string|max:160', 'role' => 'required|in:admin,user', 'password' => ['required', 'string', 'min:12', 'max:72', new PasswordByteLimit]]);
        if ($v->fails()) {
            foreach ($v->errors()->all() as $message) {
                $this->error($message);
            }

            return 1;
        }
        User::create($v->validated());
        $this->info('User created.');

        return 0;
    }
}
