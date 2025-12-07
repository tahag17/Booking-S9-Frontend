import { HttpClient, HttpParams, HttpStatusCode } from '@angular/common/http';
import {
  computed,
  inject,
  Injectable,
  signal,
  WritableSignal,
} from '@angular/core';
import { environment } from '../../../environments/environment';
import { User } from '../model/user.model';
import { State } from '../model/state.model';
import { Observable } from 'rxjs';
import { Location } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  http = inject(HttpClient);

  location = inject(Location);

  notConnected = 'NOT_CONNECTED';

  // 🔥 MOCK USER — change this to simulate authenticated user
  private mockUser: User | null = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    imageUrl: 'https://i.pravatar.cc/150?img=3',
    authorities: ['ROLE_USER', 'ROLE_LANDLORD'],
  };

  // private fetchUser$: WritableSignal<State<User>> = signal(
  //   State.Builder<User>().forSuccess({ email: this.notConnected })
  // );

  // fetchUser = computed(() => this.fetchUser$());

  // fetch(forceResync: boolean): void {
  //   this.fetchHttpUser(forceResync).subscribe({
  //     next: (user) =>
  //       this.fetchUser$.set(State.Builder<User>().forSuccess(user)),
  //     error: (err) => {
  //       if (
  //         err.status === HttpStatusCode.Unauthorized &&
  //         this.isAuthenticated()
  //       ) {
  //         this.fetchUser$.set(
  //           State.Builder<User>().forSuccess({ email: this.notConnected })
  //         );
  //       } else {
  //         this.fetchUser$.set(State.Builder<User>().forError(err));
  //       }
  //     },
  //   });
  // }

  // login(): void {
  //   location.href = `${location.origin}${this.location.prepareExternalUrl(
  //     'oauth2/authorization/okta'
  //   )}`;
  // }

  // logout(): void {
  //   this.http.post(`${environment.API_URL}/auth/logout`, {}).subscribe({
  //     next: (response: any) => {
  //       this.fetchUser$.set(
  //         State.Builder<User>().forSuccess({ email: this.notConnected })
  //       );
  //       location.href = response.logoutUrl;
  //     },
  //   });
  // }

  // isAuthenticated(): boolean {
  //   if (this.fetchUser$().value) {
  //     return this.fetchUser$().value!.email !== this.notConnected;
  //   } else {
  //     return false;
  //   }
  // }

  // fetchHttpUser(forceResync: boolean): Observable<User> {
  //   const params = new HttpParams().set('forceResync', forceResync);
  //   return this.http.get<User>(
  //     `${environment.API_URL}/auth/get-authenticated-user`,
  //     { params }
  //   );
  // }

  // hasAnyAuthority(authorities: string[] | string): boolean {
  //   if (this.fetchUser$().value!.email === this.notConnected) {
  //     return false;
  //   }
  //   if (!Array.isArray(authorities)) {
  //     authorities = [authorities];
  //   }
  //   return this.fetchUser$().value!.authorities!.some((authority: string) =>
  //     authorities.includes(authority)
  //   );
  // }

  private fetchUser$: WritableSignal<State<User>> = signal(
    this.mockUser
      ? State.Builder<User>().forSuccess(this.mockUser)
      : State.Builder<User>().forSuccess({ email: this.notConnected })
  );

  fetchUser = computed(() => this.fetchUser$());

  // -------------------------------------------
  // MOCK: Login
  // -------------------------------------------
  login(): void {
    console.log('🔵 Mock LOGIN called');

    this.mockUser = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      imageUrl: 'https://i.pravatar.cc/150?img=3',
      authorities: ['ROLE_USER', 'ROLE_LANDLORD'],
    };

    this.fetchUser$.set(State.Builder<User>().forSuccess(this.mockUser));
  }

  // -------------------------------------------
  // MOCK: Logout
  // -------------------------------------------
  logout(): void {
    console.log('🔴 Mock LOGOUT called');

    this.mockUser = null;

    this.fetchUser$.set(
      State.Builder<User>().forSuccess({
        email: this.notConnected,
      })
    );
  }

  // -------------------------------------------
  // MOCK: fetch() to simulate backend refresh
  // -------------------------------------------
  fetch(forceResync: boolean): void {
    console.log('🟡 Mock FETCH called. Force:', forceResync);

    if (this.mockUser) {
      this.fetchUser$.set(State.Builder<User>().forSuccess(this.mockUser));
    } else {
      this.fetchUser$.set(
        State.Builder<User>().forSuccess({
          email: this.notConnected,
        })
      );
    }
  }

  // -------------------------------------------
  // UTILS
  // -------------------------------------------
  isAuthenticated(): boolean {
    return this.mockUser !== null;
  }

  hasAnyAuthority(authorities: string[] | string): boolean {
    if (!this.mockUser || !this.mockUser.authorities) return false;

    if (!Array.isArray(authorities)) authorities = [authorities];

    return this.mockUser.authorities.some((a) => authorities.includes(a));
  }
}
