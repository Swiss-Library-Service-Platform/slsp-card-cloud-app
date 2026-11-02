import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { CardErrorType } from '../models/card-api.model';

/** Form-owned feedback; all errors not explicitly accepted stay global. */
export class InlineMutationError implements ErrorStateMatcher {
  public message = '';

  public constructor(private readonly types: readonly CardErrorType[]) {}

  public accept(type: CardErrorType, message: string): boolean {
    if (!this.types.includes(type)) {
      return false;
    }
    this.message = message;

    return true;
  }

  public clear(): void {
    this.message = '';
  }

  public isErrorState(
    control: FormControl | null,
    form: FormGroupDirective | NgForm | null,
  ): boolean {
    return (
      !!this.message ||
      !!(control?.invalid && (control.touched || form?.submitted))
    );
  }
}
