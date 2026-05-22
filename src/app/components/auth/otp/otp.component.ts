import { Component, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngxs/store';
import { VerifyEmailOtp, VerifyNumberOTP, VerifyRegistrationOtp } from '../../../shared/action/auth.action';
import { Breadcrumb } from '../../../shared/interface/breadcrumb';
import { AuthNumberLoginState } from '../../../shared/interface/auth.interface';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-otp',
  templateUrl: './otp.component.html',
  styleUrls: ['./otp.component.scss'],
})
export class OtpComponent {

  @ViewChildren('otpBox') otpBoxes: QueryList<ElementRef<HTMLInputElement>>;

  public digits: string[] = ['', '', '', '', '', ''];
  public otpError: boolean = false;
  public otpSubmitted: boolean = false;

  public email: string;
  public otpType: any;
  public number: AuthNumberLoginState;

  public breadcrumb: Breadcrumb = {
    title: "OTP",
    items: [{ label: 'OTP', active: true }]
  }

  constructor(
    public router: Router,
    public store: Store,
    public authService: AuthService
  ) {}

  ngOnInit(){
    this.otpType = this.authService.otpType;
    if(this.otpType === 'email'){
      this.email = this.store.selectSnapshot(state => state.auth.email);
      if(!this.email){
        this.router.navigateByUrl('/auth/login');
      }
    } else if(this.otpType === 'number'){
      this.number = this.store.selectSnapshot(state => state.auth.number);
      if(!this.number.phone){
        this.router.navigateByUrl('/auth/login');
      }
    } else if(this.otpType === 'register'){
      this.email = this.store.selectSnapshot(state => state.auth.email);
      if(!this.email){
        this.router.navigateByUrl('/auth/register');
      }
    } else {
      this.router.navigateByUrl('/auth/login');
    }
  }

  // Called only for mobile/virtual keyboards where keydown key is 'Unidentified'
  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/[^0-9]/g, '');
    this.digits[index] = val ? val[val.length - 1] : '';
    input.value = this.digits[index];

    if (this.otpSubmitted) {
      this.otpError = this.digits.join('').length < 6;
    }

    if (this.digits[index] && index < 5) {
      const boxes = this.otpBoxes.toArray();
      // Defer focus so browser finishes current key event before moving on
      setTimeout(() => boxes[index + 1]?.nativeElement.focus(), 0);
    }
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.digits[index]) {
        this.digits[index] = '';
        (event.target as HTMLInputElement).value = '';
      } else if (index > 0) {
        const boxes = this.otpBoxes.toArray();
        this.digits[index - 1] = '';
        const prev = boxes[index - 1].nativeElement;
        prev.value = '';
        prev.focus();
      }
      return;
    }

    // Desktop digit keys: prevent default so the browser doesn't insert the
    // character itself, then update state and defer focus so the full key-event
    // sequence (keydown → keypress → keyup → input) finishes on the current box
    // before moving to the next — prevents the same character leaking into it.
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      this.digits[index] = event.key;
      (event.target as HTMLInputElement).value = event.key;
      if (this.otpSubmitted) {
        this.otpError = this.digits.join('').length < 6;
      }
      if (index < 5) {
        const boxes = this.otpBoxes.toArray();
        setTimeout(() => boxes[index + 1].nativeElement.focus(), 0);
      }
      return;
    }

    // Block any other printable character
    if (event.key.length === 1) {
      event.preventDefault();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/[^0-9]/g, '').slice(0, 6);
    pasted.split('').forEach((char, i) => {
      this.digits[i] = char;
    });
    // clear any boxes beyond pasted length
    for (let i = pasted.length; i < 6; i++) {
      this.digits[i] = '';
    }
    const boxes = this.otpBoxes.toArray();
    const focusIndex = Math.min(pasted.length, 5);
    boxes[focusIndex]?.nativeElement.focus();
  }

  submit() {
    this.otpSubmitted = true;
    const otp = this.digits.join('');
    if (otp.length < 6) {
      this.otpError = true;
      return;
    }
    this.otpError = false;

    var action: any;

    if(this.otpType === 'email') {
      action = new VerifyEmailOtp({ email: this.email, token: otp });
    }

    if(this.otpType === 'register') {
      action = new VerifyRegistrationOtp({ email: this.email, otp: otp });
    }

    if(this.otpType === 'number') {
      action = new VerifyNumberOTP({
        phone: this.number.phone,
        country_code: this.number.country_code,
        token: otp
      });
    }

    this.store.dispatch(action).subscribe({
      complete: () => {
        if(this.otpType === 'email'){
          this.router.navigateByUrl('/auth/update-password');
        } else if(this.otpType === 'register'){
          this.router.navigateByUrl('/auth/login');
        } else {
          this.router.navigateByUrl('/account/dashboard');
        }
      }
    });
  }

  resendOtp() {
    this.digits = ['', '', '', '', '', ''];
    this.otpError = false;
    this.otpSubmitted = false;
    if(this.otpType === 'register'){
      this.router.navigateByUrl('/auth/register');
    } else {
      this.router.navigateByUrl('/auth/login');
    }
  }

}
