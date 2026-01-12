import { Component, ViewChild, TemplateRef, OnDestroy } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Select, Store } from '@ngxs/store';
import { Observable, forkJoin, BehaviorSubject } from 'rxjs';
import { Cart, CartAddOrUpdate } from '../../../../interface/cart.interface';
import { CartState } from '../../../../state/cart.state';
import { ClearCart, UpdateCart, DeleteCart } from '../../../../action/cart.action';
import { Router } from '@angular/router';
import { CartService } from '../../../../services/cart.service';
import { ProductService } from '../../../../services/product.service';
import { Product } from '../../../../interface/product.interface';

@Component({
  selector: 'app-cart-popup-modal',
  templateUrl: './cart-popup-modal.component.html',
  styleUrls: ['./cart-popup-modal.component.scss']
})
export class CartPopupModalComponent implements OnDestroy {

  @ViewChild("cartPopupModal", { static: false }) cartPopupModal: TemplateRef<any>;

  @Select(CartState.cartItems) cartItem$: Observable<Cart[]>;
  @Select(CartState.cartTotal) cartTotal$: Observable<number>;

  // Observable to hold enriched cart items with rating data
  public enrichedCartItems$ = new BehaviorSubject<Cart[]>([]);

  public closeResult: string;
  public modalOpen: boolean = false;

  // Cache to store fetched product details with ratings
  private productCache = new Map<string, Product>();

  constructor(
    private modalService: NgbModal,
    private store: Store,
    private router: Router,
    public cartService: CartService,
    private productService: ProductService
  ) {
    // Reactively update enriched cart items whenever the store's cart items change
    this.cartItem$.subscribe(items => {
      console.log('Cart items updated in store, re-enriching...', items?.length);
      this.enrichCartItems(items || []);
    });
  }

  private enrichCartItems(cartItems: Cart[]) {
    const enrichedItems = cartItems.map(item => {
      const cachedProduct = item.product?.slug ? this.productCache.get(item.product.slug) : null;
      if (cachedProduct) {
        // Prefer the highest rating we've seen (API vs what's in Cart)
        // to prevent 0 ratings from the API overwriting valid data
        const finalRating = Math.max(cachedProduct.rating_count || 0, item.product?.rating_count || 0);
        const finalReviews = Math.max(cachedProduct.reviews_count || 0, item.product?.reviews_count || 0);

        return {
          ...item,
          product: {
            ...item.product,
            ...cachedProduct,
            rating_count: finalRating,
            reviews_count: finalReviews,
            reviews: cachedProduct.reviews || item.product?.reviews || []
          }
        };
      }
      return item;
    });
    this.enrichedCartItems$.next(enrichedItems);
  }

  async openModal() {
    this.modalOpen = true;

    const cartItems = this.store.selectSnapshot(CartState.cartItems);
    this.enrichCartItems(cartItems || []);

    if (cartItems && cartItems.length > 0) {
      const productRequests = cartItems
        .filter(item => item.product && item.product.slug && !this.productCache.has(item.product.slug))
        .map(item => this.productService.getProductBySlug(item.product!.slug));

      if (productRequests.length > 0) {
        forkJoin(productRequests).subscribe({
          next: (products: Product[]) => {
            products.forEach(p => {
              if (p.slug) this.productCache.set(p.slug, p);
            });
            // Re-enrich with newly fetched data
            this.enrichCartItems(this.store.selectSnapshot(CartState.cartItems) || []);
          },
          error: (error) => {
            console.error('Error fetching product details:', error);
          }
        });
      }
    }

    this.modalService.open(this.cartPopupModal, {
      ariaLabelledBy: 'Cart-Popup-Modal',
      centered: true,
      windowClass: 'theme-modal cart-popup-modal',
      backdrop: 'static',
      keyboard: true
    }).result.then((result) => {
      `Result ${result}`
    }, (reason) => {
      this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  private getDismissReason(reason: ModalDismissReasons): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return `with: ${reason}`;
    }
  }

  closeModal() {
    this.modalService.dismissAll();
  }

  trackByItem(index: number, item: Cart) {
    return item.id;
  }

  updateQuantity(item: Cart, qty: number) {
    const params: CartAddOrUpdate = {
      id: item?.id,
      product_id: item?.product?.id,
      product: item?.product ? item?.product : null,
      variation_id: item?.variation_id ? item?.variation_id : null,
      variation: item?.variation ? item?.variation : null,
      quantity: qty
    }
    this.store.dispatch(new UpdateCart(params));
    this.cartService.updateQty();
  }

  clearCart() {
    this.store.dispatch(new ClearCart());
  }

  viewCart() {
    this.closeModal();
    this.router.navigate(['/cart']);
  }

  checkout() {
    this.closeModal();
    this.router.navigate(['/checkout']);
  }

  ngOnDestroy() {
    if (this.modalOpen) {
      this.modalService.dismissAll();
    }
  }
}

