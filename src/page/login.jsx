import React, { useState } from 'react';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaShieldAlt } from 'react-icons/fa';
import { userAPI } from '../lib/supabaseClient';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: credentials, 2: security question
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [userId, setUserId] = useState(null);

  const handleFirstStep = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Verify username and password
      const { data, error } = await userAPI.verifyCredentials(username, password);

      if (error || !data) {
        setError('Invalid username or password');
        setIsLoading(false);
        return;
      }

      // Store security question for display
      setSecurityQuestion(data.security_question);
      setUserId(data.id);
      setStep(2);
      setError('');
    } catch (err) {
      setError('An error occurred during login');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!securityAnswer.trim()) {
        setError('Please answer the security question');
        setIsLoading(false);
        return;
      }

      // Verify security answer
      const { data, error } = await userAPI.verifySecurityAnswer(username, securityAnswer);

      if (error || !data) {
        setError('Incorrect security answer');
        setIsLoading(false);
        return;
      }

      // Successful login
      onLogin({
        id: data.id,
        username: data.username,
        email: data.email,
        fullName: data.full_name,
        role: data.role,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setError('An error occurred during login');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setSecurityAnswer('');
    setSecurityQuestion('');
    setError('');
  };

  return (
    <div className="flex min-h-screen overflow-hidden bg-white">
      {/* Left Side - Clean Minimal Login Form */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-6 py-12 bg-white md:w-1/2 md:py-0">
        <div className="w-full max-w-md">
          {/* Heading Section */}
          <div className="mb-12">
            <h1 className="mb-2 text-4xl font-bold tracking-tight text-gray-900">Sign In</h1>
            <p className="text-base text-gray-600">Enter your username and password to sign in</p>
          </div>

          {/* Login Form Card - Clean White Card */}
          <div className="p-8 bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* Logo Section - Inside Card Top */}
            <div className="flex justify-center mb-6">
              <img 
                src="/fs.png" 
                alt="DATS Logo" 
                className="w-auto h-16 drop-shadow-lg"
              />
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step >= 1 ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  1
                </div>
                <div className={`w-12 h-1 transition-all rounded-full ${step >= 2 ? 'bg-teal-500' : 'bg-gray-200'}`} />
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step >= 2 ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  2
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 mb-6 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Credentials */}
            {step === 1 && (
              <form onSubmit={handleFirstStep} className="space-y-6">
                {/* Username Field */}
                <div>
                  <label htmlFor="username" className="block mb-2 text-sm font-semibold text-gray-900">
                    Username
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 transition-colors pointer-events-none group-focus-within:text-teal-500">
                      <FaUser className="text-base" />
                    </div>
                    <input
                      type="text"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      placeholder="Enter your username"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block mb-2 text-sm font-semibold text-gray-900">
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 transition-colors pointer-events-none group-focus-within:text-teal-500">
                      <FaLock className="text-base" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full py-2.5 pl-10 pr-11 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-teal-500"
                    >
                      {showPassword ? <FaEyeSlash className="text-base" /> : <FaEye className="text-base" />}
                    </button>
                  </div>
                </div>

                {/* Next Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-2.5 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mt-8 ${
                    isLoading
                      ? 'bg-teal-400 cursor-not-allowed'
                      : 'bg-teal-500 hover:bg-teal-600 active:scale-98 transform'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    'Continue to Verification'
                  )}
                </button>
              </form>
            )}

            {/* Step 2: Security Question */}
            {step === 2 && (
              <form onSubmit={handleFinalSubmit} className="space-y-6">
                <div className="mb-8 text-center">
                  <div className="flex items-center justify-center mx-auto mb-4 text-2xl text-teal-500 border border-teal-200 rounded-full w-14 h-14 bg-teal-50">
                    <FaShieldAlt />
                  </div>
                  <h2 className="mb-2 text-2xl font-bold text-gray-900">Security Verification</h2>
                  <p className="text-sm text-gray-600">Answer your security question to proceed</p>
                </div>

                {/* Display Security Question */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-900">
                    Security Question
                  </label>
                  <div className="p-4 border border-gray-300 rounded-lg bg-gray-50">
                    <p className="font-medium text-gray-900">{securityQuestion}</p>
                  </div>
                </div>

                {/* Security Answer Field */}
                <div>
                  <label htmlFor="securityAnswer" className="block mb-2 text-sm font-semibold text-gray-900">
                    Your Answer
                  </label>
                  <input
                    type="text"
                    id="securityAnswer"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    className="w-full px-4 py-2.5 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    placeholder="Enter your answer"
                    required
                    autoComplete="off"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 py-2.5 font-semibold text-gray-700 transition-all duration-200 bg-gray-100 rounded-lg hover:bg-gray-200 active:scale-98"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`flex-1 py-2.5 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                      isLoading
                        ? 'bg-teal-400 cursor-not-allowed'
                        : 'bg-teal-500 hover:bg-teal-600 active:scale-98'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              © 2026 DATS. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Teal Background Image with Single Logo */}
      <div className="relative items-center justify-center hidden w-1/2 overflow-hidden bg-center bg-cover md:flex" style={{backgroundImage: 'url(/bill.jpg)'}}>
        {/* Subtle overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-teal-900/30 via-transparent to-transparent"></div>
      </div>

      <style>{`
        .scale-98 {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}

export default Login;