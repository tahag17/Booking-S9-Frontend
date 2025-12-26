# Display Listings by Landlord - Frontend Implementation

This document describes the **frontend implementation** of the **Display Listings by Landlord** feature in Angular.

The purpose of this feature is to allow landlords to **view and manage their property listings** through a reactive, user-friendly interface.

---

## Feature Goal

The frontend implementation aims to:

- Display all listings belonging to the authenticated landlord
- Show listing cards with cover images, location, price, and category
- Allow landlords to delete their listings with confirmation feedback
- Provide real-time loading states during data fetching and deletion
- Implement proper authorization checks to ensure only landlords can access this feature

---

## Architectural Approach

The implementation follows **Angular's modern reactive patterns**:

- **Models/Interfaces**: Define the shape of data coming from the backend
- **Services**: Handle HTTP communication and state management using Angular Signals
- **Components**: Display UI and handle user interactions
- **Guards**: Protect routes with authorization logic
- **Routing**: Define navigation paths with role-based access control

---

## Components Implemented

---

### 1️. Data Models

#### Location

```
src/app/landlord/model/listing.model.ts
```

#### Code

```typescript
export interface DisplayPicture {
  file?: string;
  fileContentType?: string;
  isCover?: boolean;
}

export interface CardListing {
  price: PriceVO;
  location: string;
  cover: DisplayPicture;
  bookingCategory: CategoryName;
  publicId: string;
  loading: boolean;
}
```

#### Purpose

**`DisplayPicture`**  
Represents the picture data for a listing. The `file` property contains the base64-encoded image data, while `fileContentType` specifies the MIME type (e.g., `image/jpeg`). The `isCover` flag indicates whether this is the main cover image.

**`CardListing`**  
Represents a single listing card to be displayed in the UI. This interface mirrors the backend's `DisplayCardListingDTO` and includes:

- **`price`**: A value object containing the listing price
- **`location`**: The location code (later converted to a readable format)
- **`cover`**: The main display picture
- **`bookingCategory`**: The category type of the listing
- **`publicId`**: Unique identifier for the listing
- **`loading`**: A UI-specific flag to show loading state during operations (like deletion)

---

#### Location

```
src/app/tenant/model/booking.model.ts
```

#### Code

```typescript
export interface BookedDatesDTOFromServer {
  startDate: Date;
  endDate: Date;
}

export interface BookedListing {
  location: string;
  cover: DisplayPicture;
  totalPrice: PriceVO;
  dates: BookedDatesDTOFromServer;
  bookingPublicId: string;
  listingPublicId: string;
  loading: boolean;
}
```

#### Purpose

**`BookedDatesDTOFromServer`**  
Represents the date range for a booking, received from the backend.

**`BookedListing`**  
Similar to `CardListing` but for tenant bookings. It includes booking-specific fields like `dates`, `bookingPublicId`, and `totalPrice` instead of a per-night price. This allows the same card component to be reused for both landlord properties and tenant bookings.

---

### 2️. LandlordListingService

#### Location

```
src/app/landlord/landlordlisting.service.ts
```

#### Code

```typescript
private getAll$: WritableSignal<State<Array<CardListing>>> =
  signal(State.Builder<Array<CardListing>>().forInit())
getAllSig = computed(() => this.getAll$());

private delete$: WritableSignal<State<string>> =
  signal(State.Builder<string>().forInit())
deleteSig = computed(() => this.delete$());

getAll(): void {
  this.http.get<Array<CardListing>>(`${environment.API_URL}/landlord-listing/get-all`)
    .subscribe({
      next: listings => this.getAll$.set(State.Builder<Array<CardListing>>().forSuccess(listings)),
      error: err => this.create$.set(State.Builder<CreatedListing>().forError(err)),
    });
}

delete(publicId: string): void {
  const params = new HttpParams().set("publicId", publicId);
  this.http.delete<string>(`${environment.API_URL}/landlord-listing/delete`, {params})
    .subscribe({
      next: publicId => this.delete$.set(State.Builder<string>().forSuccess(publicId)),
      error: err => this.create$.set(State.Builder<CreatedListing>().forError(err)),
    });
}

resetDelete() {
  this.delete$.set(State.Builder<string>().forInit());
}
```

#### Purpose

This service manages the **state and HTTP communication** for landlord listing operations using **Angular Signals**.

**Understanding Angular Signals:**

- **`WritableSignal`**: A reactive value that can be updated and automatically notifies listeners when it changes
- **`computed`**: Creates a read-only derived signal that updates automatically when its dependencies change
- **`signal()`**: Creates a new writable signal with an initial value

**State Management Pattern:**

- Each operation (getAll, delete) has a private writable signal (`getAll$`, `delete$`)
- Public computed signals (`getAllSig`, `deleteSig`) expose these states as read-only
- Components can react to state changes without directly modifying the state

**Methods Explained:**

**`getAll()`**  
Makes an HTTP GET request to fetch all listings for the authenticated landlord. When successful, it updates the `getAll$` signal with the listings wrapped in a success state. Components listening to `getAllSig()` will automatically react to this change.

**`delete(publicId: string)`**  
Sends an HTTP DELETE request with the listing's public ID as a query parameter. On success, updates the `delete$` signal with the deleted listing's ID. This allows components to remove the listing from the UI optimistically.

**`resetDelete()`**  
Resets the delete state back to its initial state. This is useful for clearing error or success states after handling them in the UI.

**Why Signals?**  
Signals provide a more performant and intuitive way to manage reactive state compared to RxJS subjects. They automatically track dependencies and trigger updates only when necessary, making the code easier to reason about and debug.

---

### 3️. PropertiesComponent

#### Location

```
src/app/landlord/properties/properties.component.ts
```

#### Code

```typescript
@Component({
  selector: "app-properties",
  standalone: true,
  imports: [CardListingComponent, FaIconComponent],
  templateUrl: "./properties.component.html",
  styleUrl: "./properties.component.scss",
})
export class PropertiesComponent implements OnInit, OnDestroy {
  landlordListingService = inject(LandlordListingService);
  toastService = inject(ToastService);
  listings: Array<CardListing> | undefined = [];
  loadingDeletion = false;
  loadingFetchAll = false;

  constructor() {
    this.listenFetchAll();
    this.listenDeleteByPublicId();
  }

  private listenFetchAll() {
    effect(() => {
      const allListingState = this.landlordListingService.getAllSig();
      if (allListingState.status === "OK" && allListingState.value) {
        this.loadingFetchAll = false;
        this.listings = allListingState.value;
      } else if (allListingState.status === "ERROR") {
        this.toastService.send({
          severity: "error",
          summary: "Error",
          detail: "Error when fetching the listing",
        });
      }
    });
  }

  private listenDeleteByPublicId() {
    effect(() => {
      const deleteState = this.landlordListingService.deleteSig();
      if (deleteState.status === "OK" && deleteState.value) {
        const listingToDeleteIndex = this.listings?.findIndex((listing) => listing.publicId === deleteState.value);
        this.listings?.splice(listingToDeleteIndex!, 1);
        this.toastService.send({
          severity: "success",
          summary: "Deleted successfully",
          detail: "Listing deleted successfully.",
        });
      } else if (deleteState.status === "ERROR") {
        const listingToDeleteIndex = this.listings?.findIndex((listing) => listing.publicId === deleteState.value);
        this.listings![listingToDeleteIndex!].loading = false;
        this.toastService.send({
          severity: "error",
          summary: "Error",
          detail: "Error when deleting the listing",
        });
      }
      this.loadingDeletion = false;
    });
  }

  ngOnInit(): void {
    this.fetchListings();
  }

  onDeleteListing(listing: CardListing): void {
    listing.loading = true;
    this.landlordListingService.delete(listing.publicId);
  }

  private fetchListings() {
    this.loadingFetchAll = true;
    this.landlordListingService.getAll();
  }

  ngOnDestroy(): void {}
}
```

#### Purpose

This is the **main container component** for displaying and managing landlord properties.

**Understanding Angular Effects:**

- **`effect()`**: Runs code automatically whenever any signal it reads changes
- Effects are declared in the constructor to ensure they're set up before the component initializes
- They provide a reactive way to respond to state changes without manual subscriptions

**Key Methods:**

**`listenFetchAll()`**  
Sets up a reactive effect that monitors the `getAllSig()` signal. When listings are successfully fetched:

- Sets `loadingFetchAll` to false
- Updates the local `listings` array with the fetched data
- The UI automatically re-renders to show the listings

If an error occurs, displays an error toast notification to the user.

**`listenDeleteByPublicId()`**  
Monitors the delete operation state. When a listing is successfully deleted:

- Finds the listing in the local array by its `publicId`
- Removes it using `splice()` (this triggers UI update)
- Shows a success toast notification

If deletion fails:

- Resets the `loading` flag on that specific listing
- Shows an error toast notification
- The listing remains in the UI for the user to retry

**`onDeleteListing(listing: CardListing)`**  
Called when the user clicks the delete button on a listing card:

- Sets the `loading` flag to true on that specific listing (shows spinner)
- Calls the service's `delete()` method
- The effect in `listenDeleteByPublicId()` handles the response

**`fetchListings()`**  
Initiates the listing fetch process when the component loads:

- Sets `loadingFetchAll` to true (shows loading spinner)
- Calls the service's `getAll()` method
- The effect in `listenFetchAll()` handles the response

**Why Effects Instead of Subscriptions?**  
Effects automatically clean themselves up and re-run when dependencies change. This eliminates the need for manual unsubscribe logic and makes the code more declarative and easier to maintain.

---

#### Location

```
src/app/landlord/properties/properties.component.html
```

#### Code

```html
<h1>My properties</h1>
<h2>Add new and remove properties</h2>

@if (listings && listings.length > 0 || loadingFetchAll) {
<div class="listing-grid">
  @for(listing of listings; track listing.publicId) {
  <app-card-listing [listing]="listing" [cardMode]="'landlord'" (deleteListing)="onDeleteListing($event)"> </app-card-listing>
  }
</div>
} @else {
<div class="flex flex-column justify-content-center align-items-center h-10rem">
  <h1>No property present</h1>
  <div class="text-xl">It seems that you don't have any properties yet</div>
</div>
} @if(loadingFetchAll) {
<div class="flex justify-content-center align-items-center h-15rem">
  <fa-icon [icon]="'circle-notch'" size="3x" animation="spin" class="ml-2 text-primary"></fa-icon>
</div>
}
```

#### Purpose

The template uses **Angular's modern control flow syntax** (`@if`, `@for`) introduced in Angular 17+.

**Template Logic Explained:**

**Conditional Rendering (`@if`)**

- Shows the listing grid if there are listings OR if data is currently loading
- Shows an empty state message if there are no listings and loading is complete
- Shows a loading spinner while fetching data

**Loop Rendering (`@for`)**

- Iterates over each listing in the array
- `track listing.publicId` tells Angular how to identify each item for efficient re-rendering
- Passes the listing data to the child `CardListingComponent`
- Sets `cardMode` to `'landlord'` to show landlord-specific UI (delete button)
- Binds the `deleteListing` event to the parent's `onDeleteListing()` method

**Why This Syntax?**  
The `@if` and `@for` syntax is more readable and performant than the older `*ngIf` and `*ngFor` directives. It also provides better type checking and IDE support.

---

### 4️. CardListingComponent (Shared)

#### Location

```
src/app/shared/card-listing/card-listing.component.ts
```

#### Code

```typescript
export class CardListingComponent {
  listing = input.required<CardListing | BookedListing>();
  cardMode = input<"landlord" | "booking">();

  @Output()
  deleteListing = new EventEmitter<CardListing>();
  @Output()
  cancelBooking = new EventEmitter<BookedListing>();

  bookingListing: BookedListing | undefined;
  cardListing: CardListing | undefined;

  router = inject(Router);
  categoryService = inject(CategoryService);
  countryService = inject(CountryService);

  constructor() {
    this.listenToListing();
    this.listenToCardMode();
  }

  private listenToListing() {
    effect(() => {
      const listing = this.listing();
      this.countryService.getCountryByCode(listing.location).subscribe({
        next: (country) => {
          if (listing) {
            this.listing().location = country.region + ", " + country.name.common;
          }
        },
      });
    });
  }

  private listenToCardMode() {
    effect(() => {
      const cardMode = this.cardMode();
      if (cardMode && cardMode === "booking") {
        this.bookingListing = this.listing() as BookedListing;
      } else {
        this.cardListing = this.listing() as CardListing;
      }
    });
  }

  onDeleteListing(displayCardListingDTO: CardListing) {
    this.deleteListing.emit(displayCardListingDTO);
  }

  onCancelBooking(bookedListing: BookedListing) {
    this.cancelBooking.emit(bookedListing);
  }

  onClickCard(publicId: string) {
    this.router.navigate(["listing"], { queryParams: { id: publicId } });
  }
}
```

#### Purpose

This is a **reusable component** that displays a listing card. It can be used for both landlord properties and tenant bookings by changing the `cardMode`.

**Understanding Modern Angular Inputs:**

- **`input.required<T>()`**: Creates a required input that must be provided by the parent
- **`input<T>()`**: Creates an optional input with a default value
- **`@Output()`**: Creates an event emitter that the parent can listen to

**Key Methods:**

**`listenToListing()`**  
Sets up an effect that converts location codes (e.g., "US") into readable text (e.g., "North America, United States"):

- Reads the listing's location code
- Calls the `countryService` to fetch country details
- Updates the listing's location with a formatted string

**`listenToCardMode()`**  
Determines which type of listing to display based on the `cardMode` input:

- If mode is `"booking"`, casts the listing to `BookedListing`
- Otherwise, casts it to `CardListing`
- This allows the template to access mode-specific properties

**`onDeleteListing()`**  
Emits a delete event to the parent component when the delete button is clicked. The parent component handles the actual deletion logic.

**`onCancelBooking()`**  
Similar to delete but for canceling bookings (used when `cardMode` is `"booking"`).

**`onClickCard()`**  
Navigates to the listing detail page when the user clicks on the card (except the delete button). Passes the listing's public ID as a query parameter.

**Why Reusable?**  
By accepting different listing types and a mode parameter, this component can be used across the application for different purposes without duplicating code.

---

#### Location

```
src/app/shared/card-listing/card-listing.component.html
```

#### Code

```html
<div class="card relative cursor-pointer">
  <div (click)="onClickCard(cardMode() === 'booking' ? bookingListing?.listingPublicId! : cardListing?.publicId!)">
    <div class="border-1 border-transparent border-round-3xl bg-cover bg-center bg-no-repeat h-24rem w-full" [style.background-image]="'url(' + 'data:' + listing().cover.fileContentType + ';base64,' + listing().cover.file + ')'"></div>
    <div class="mt-2 font-bold">{{ listing().location }}</div>

    @if (cardMode() === 'booking') {
    <div>{{ bookingListing?.dates?.startDate | date: "mediumDate" }} - {{ bookingListing?.dates?.endDate | date: "mediumDate" }}</div>
    <div class="mt-2">
      <span class="font-bold">{{ bookingListing?.totalPrice?.value | currency }}</span>
    </div>
    } @else {
    <div>{{ categoryService.getCategoryByTechnicalName(cardListing?.bookingCategory!)?.displayName }}</div>
    <div class="mt-2">
      <span class="font-bold">{{ cardListing?.price?.value! | currency }}</span>
    </div>
    }
  </div>
  @if (cardMode() === "landlord") {
  <button [disabled]="cardListing?.loading" class="absolute trash-btn p-button" (click)="onDeleteListing(cardListing!)">
    @if (cardListing?.loading) {
    <fa-icon icon="circle-notch" animation="spin"></fa-icon>
    } @else {
    <fa-icon icon="trash-can"></fa-icon>
    }
  </button>
  } @if (cardMode() === "booking") {
  <button [disabled]="bookingListing?.loading" class="absolute trash-btn p-button" (click)="onCancelBooking(bookingListing!)">
    @if (bookingListing?.loading) {
    <fa-icon icon="circle-notch" animation="spin"></fa-icon>
    } @else {
    <fa-icon icon="trash-can"></fa-icon>
    }
  </button>
  }
</div>
```

#### Purpose

This template displays a listing card with different content based on the `cardMode`.

**Template Features:**

**Cover Image Display**

- Uses `[style.background-image]` to display the base64-encoded image
- The data URI format combines the MIME type and encoded data: `data:image/jpeg;base64,/9j/4AAQ...`
- Tailwind classes provide responsive sizing and rounded corners

**Conditional Content Based on Mode**

- **Booking mode**: Shows booking dates and total price
- **Landlord mode**: Shows category and per-night price
- Both modes display the location (already formatted by the component)

**Action Buttons**

- Only shows a delete button when in `"landlord"` mode
- Only shows a cancel button when in `"booking"` mode
- The button is disabled during loading operations
- Shows a spinner icon while loading, trash icon otherwise

**Click Navigation**

- The entire card is clickable (except the delete button)
- Navigates to different routes based on the mode
- Uses the appropriate ID (listingPublicId for bookings, publicId for properties)

**Angular Pipes Used:**

- **`date`**: Formats dates in a readable format (e.g., "Jan 15, 2025")
- **`currency`**: Formats numbers as currency with the appropriate symbol

---

### 5️. Route Configuration

#### Location

```
src/app/app.routes.ts
```

#### Code

```typescript
export const routes: Routes = [
  {
    path: "landlord/properties",
    component: PropertiesComponent,
    canActivate: [authorityRouteAccess],
    data: {
      authorities: ["ROLE_LANDLORD"],
    },
  },
  // ... other routes
];
```

#### Purpose

Defines the route for the properties page with **role-based access control**.

**Route Configuration Explained:**

**`path`**  
The URL path users navigate to: `/landlord/properties`

**`component`**  
The component to render when this route is active

**`canActivate`**  
An array of guards that must return `true` before the route can be activated. Here we use `authorityRouteAccess` to check if the user has the required role.

**`data`**  
Custom data passed to the route. The `authorities` array specifies that only users with `ROLE_LANDLORD` can access this route.

**How It Works:**

1. User navigates to `/landlord/properties`
2. The `authorityRouteAccess` guard runs before loading the component
3. The guard checks if the user has `ROLE_LANDLORD`
4. If yes, the component loads; if no, the user is redirected to login

---

### 6️. Authorization Guard

#### Location

```
src/app/auth/authority-route-access.ts
```

#### Code

```typescript
export const authorityRouteAccess: CanActivateFn = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  return authService.fetchHttpUser(false).pipe(
    map((connectedUser) => {
      if (connectedUser) {
        const authorities = next.data["authorities"];
        return !authorities || authorities.length === 0 || authService.hasAnyAuthority(authorities);
      }
      authService.login();
      return false;
    })
  );
};
```

#### Purpose

This is a **functional route guard** that protects routes based on user roles.

**Understanding Functional Guards:**

- **`CanActivateFn`**: A function type that returns `boolean`, `Observable<boolean>`, or `Promise<boolean>`
- Replaces the older class-based guard pattern
- Can be used directly in route configurations

**Guard Logic Explained:**

**`fetchHttpUser(false)`**  
Fetches the currently authenticated user from the backend. The `false` parameter means it won't force a refresh if the user is already cached.

**RxJS `pipe()` and `map()`:**

- **`pipe()`**: Chains RxJS operators together
- **`map()`**: Transforms the observable's emitted value

**Authorization Check:**

1. If a user is connected:

   - Extract the `authorities` array from the route's data
   - If no authorities are specified, allow access
   - Otherwise, check if the user has any of the required authorities
   - Return `true` to allow access, `false` to deny

2. If no user is connected:
   - Call `authService.login()` to redirect to the login page
   - Return `false` to prevent route activation

**Why Observable?**  
The guard returns an `Observable<boolean>` because fetching the user data is asynchronous. The router waits for the observable to emit a value before deciding whether to activate the route.

---

## Complete User Flow

1. **User navigates to `/landlord/properties`**

2. **Route guard activates:**

   - Checks if user is authenticated
   - Verifies user has `ROLE_LANDLORD`
   - Redirects to login if unauthorized

3. **Component initializes:**

   - `PropertiesComponent` constructor sets up effects
   - `ngOnInit()` calls `fetchListings()`

4. **Service fetches data:**

   - HTTP GET request to backend
   - Response updates the `getAll$` signal

5. **Effect reacts to state change:**

   - `listenFetchAll()` detects the signal update
   - Updates the `listings` array
   - Sets `loadingFetchAll` to false

6. **Template updates:**

   - Angular detects the array change
   - Renders a grid of `CardListingComponent` instances
   - Each card displays the listing details

7. **User clicks delete:**

   - `onDeleteListing()` is called
   - Sets `loading` flag on the specific listing
   - Service sends DELETE request

8. **Effect reacts to delete state:**

   - `listenDeleteByPublicId()` detects the signal update
   - Removes the listing from the array
   - Shows success toast notification

9. **Template updates:**
   - Angular removes the card from the DOM
   - User sees the updated grid without the deleted listing

---

## Current Status

### Implemented:

- Data models for listings and bookings
- Service with signal-based state management
- Main properties component with reactive effects
- Reusable card component with mode switching
- Role-based route protection
- Delete functionality with optimistic UI updates
- Location formatting with country service
- Loading states and error handling
- Toast notifications for user feedback

### ⏳ Angular Concepts Used

- **Signals**: Modern reactive state management
- **Effects**: Automatic reactions to state changes
- **Inputs/Outputs**: Component communication
- **Functional Guards**: Route protection
- **Modern Control Flow**: `@if`, `@for` syntax
- **Dependency Injection**: `inject()` function
- **RxJS Observables**: Async data handling
- **HttpClient**: Backend communication

---

## Key Angular Patterns

### Signals vs RxJS

- **Signals**: Used for local component state that needs to trigger updates
- **RxJS**: Used for HTTP requests and complex async operations
- They work together: HTTP observables update signals, which trigger effects

### Smart vs Presentational Components

- **`PropertiesComponent`** (Smart): Manages data fetching, state, and business logic
- **`CardListingComponent`** (Presentational): Receives data via inputs, emits events via outputs

### Reactive Programming

- Effects automatically run when their dependencies change
- No manual subscription management needed
- Cleaner code with automatic cleanup
