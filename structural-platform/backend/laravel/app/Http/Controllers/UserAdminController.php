<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Rules\PasswordByteLimit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserAdminController extends Controller
{
    public function index()
    {
        return response()->json(['data' => User::orderBy('id')->get()]);
    }

    public function store(Request $r)
    {
        return $this->save($r, new User);
    }

    public function update(Request $r, User $user)
    {
        return $this->save($r, $user);
    }

    private function save(Request $r, User $user)
    {
        $data = $r->validate(['name' => 'required|string|max:160|regex:/\S/u', 'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($user->id)], 'role' => ['required', Rule::in(['admin', 'user'])], 'password' => [$user->exists ? 'sometimes' : 'required', 'string', 'min:12', 'max:72', new PasswordByteLimit]]);

        return DB::transaction(function () use ($r, $user, $data) {
            if ($user->exists && $user->role === 'admin' && $data['role'] !== 'admin') {
                abort_if($r->user()->id === $user->id, 409, 'You cannot demote your own account.');
                abort_if(User::where('role', 'admin')->lockForUpdate()->count() <= 1, 409, 'The last administrator must remain.');
            }
            $user->fill($data);
            $user->save();

            return response()->json(['data' => $user], $user->wasRecentlyCreated ? 201 : 200);
        });
    }

    public function destroy(Request $r, User $user)
    {
        return DB::transaction(function () use ($r, $user) {
            abort_if($r->user()->id === $user->id, 409, 'You cannot delete your own account.');
            abort_if($user->role === 'admin' && User::where('role', 'admin')->lockForUpdate()->count() <= 1, 409, 'The last administrator must remain.');
            $user->delete();

            return response()->json(['data' => null]);
        });
    }
}
