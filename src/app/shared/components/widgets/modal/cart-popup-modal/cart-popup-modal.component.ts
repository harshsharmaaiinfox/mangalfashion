import { Component, ViewChild, TemplateRef, OnDestroy } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Select, Store } from '@ngxs/store';
import { Observable, forkJoin } from 'rxjs';
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

  public closeResult: string;
  public modalOpen: boolean = false;

  constructor(
    private modalService: NgbModal,
    private store: Store,
    private router: Router,
    public cartService: CartService,
    private productService: ProductService
  ) {}

  async openModal() {
    this.modalOpen = true;

    // Fetch full product details with ratings for cart items
    this.cartItem$.subscribe(cartItems => {
      if (cartItems && cartItems.length > 0) {
        const productRequests = cartItems
          .filter(item => item.product && item.product.slug)
          .map(item => this.productService.getProductBySlug(item.product!.slug));

        if (productRequests.length > 0) {
          forkJoin(productRequests).subscribe({
            next: (products: Product[]) => {
              // Update cart items with full product data including ratings
              cartItems.forEach((item, index) => {
                if (products[index]) {
                  item.product = { ...item.product, ...products[index] };
                }
              });
            },
            error: (error) => {
              console.error('Error fetching product details:', error);
            }
          });
        }
      }
    });

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

