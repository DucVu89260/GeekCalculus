<?php

namespace App\Http\Controllers;

use App\Rules\PasswordByteLimit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function csrf(Request $request)
    {
        return response()->json(['csrf_token' => csrf_token()]);
    }

    public function me(Request $request)
    {
        return response()->json(['data' => $request->user()]);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate(['email' => 'required|email', 'password' => ['required', 'string', new PasswordByteLimit]]);
        if (! Auth::attempt($credentials)) {
            throw ValidationException::withMessages(['email' => ['Invalid email or password.']]);
        }
        $request->session()->regenerate();

        return response()->json(['data' => $request->user(), 'csrf_token' => csrf_token()]);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['data' => null, 'csrf_token' => csrf_token()]);
    }
}
