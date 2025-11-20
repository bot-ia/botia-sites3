import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';

type FormMode = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private fb: FormBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  languageService = inject(LanguageService);

  mode = signal<FormMode>('login');
  errorMessage = signal<string | null>(null);
  isLoading = signal(false);
  resetEmailSent = signal<string | null>(null);

  loginForm = this.fb.group({
    email: ['client1@example.com', [Validators.required, Validators.email]],
    password: ['password', [Validators.required]],
  });

  registerForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  forgotPasswordForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get form() {
    if (this.mode() === 'login') return this.loginForm;
    if (this.mode() === 'register') return this.registerForm;
    return this.forgotPasswordForm;
  }

  setMode(newMode: FormMode) {
    this.mode.set(newMode);
    this.errorMessage.set(null);
    this.resetEmailSent.set(null);
    this.loginForm.reset({email: '', password: ''});
    this.registerForm.reset();
    this.forgotPasswordForm.reset();
  }

  async onSubmit() {
    if (this.form.invalid) {
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      if (this.mode() === 'login') {
        const { email, password } = this.loginForm.value;
        await this.authService.login(email!, password!);
      } else {
        const { email, password } = this.registerForm.value;
        await this.authService.register(email!, password!);
      }
    } catch (err: any) {
      const errorKey = err.message || 'ERROR_UNKNOWN';
      this.errorMessage.set(this.languageService.T(errorKey));
    } finally {
      this.isLoading.set(false);
    }
  }

  async onForgotPasswordSubmit() {
    if (this.forgotPasswordForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.resetEmailSent.set(null);

    const { email } = this.forgotPasswordForm.value;
    try {
      await this.authService.resetPasswordForEmail(email!);
      this.resetEmailSent.set(this.languageService.T('resetLinkSentMessage'));
      this.forgotPasswordForm.reset();
    } catch (err: any) {
      // In a real app, you might not want to show specific errors here for security
      const errorKey = err.message || 'ERROR_UNKNOWN';
      this.errorMessage.set(this.languageService.T(errorKey));
    } finally {
      this.isLoading.set(false);
    }
  }

  async onGoogleSignIn() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
        await this.authService.signInWithGoogle();
    } catch (err: any) {
        const errorKey = err.message || 'ERROR_UNKNOWN';
        this.errorMessage.set(this.languageService.T(errorKey));
    } finally {
        this.isLoading.set(false);
    }
  }
}