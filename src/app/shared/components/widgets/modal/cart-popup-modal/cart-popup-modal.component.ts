import { Component, ViewChild, TemplateRef, OnDestroy } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Select, Store } from '@ngxs/store';
import { Observable, forkJoin, BehaviorSubject } from 'rxjs';
import { Cart, CartAddOrUpdate } from '../../../../interface/cart.interface';
import { CartState } from '../../../../state/cart.state';
import { ClearCart, UpdateCart, DeleteCart, AddToCart } from '../../../../action/cart.action';
import { AddToWishlist, DeleteWishlist } from '../../../../action/wishlist.action';
import { Router } from '@angular/router';
import { CartService } from '../../../../services/cart.service';
import { ProductService } from '../../../../services/product.service';
import { Product } from '../../../../interface/product.interface';
import { Attribute, AttributeValue } from '../../../../interface/attribute.interface';

@Component({
  selector: 'app-cart-popup-modal',
  templateUrl: './cart-popup-modal.component.html',
  styleUrls: ['./cart-popup-modal.component.scss']
})
export class CartPopupModalComponent implements OnDestroy {

  @ViewChild("cartPopupModal", { static: false }) cartPopupModal: TemplateRef<any>;

  public closeResult: string;
  public modalOpen: boolean = false;
  public product: Product | null = null;
  public quantity: number = 1;

  public sizeAttribute: Attribute | null = null;
  public selectedSize: AttributeValue | null = null;

  public waistAttribute: Attribute | null = null;
  public selectedWaist: AttributeValue | null = null;

  public addToCartLoader: boolean = false;

  constructor(
    private modalService: NgbModal,
    private store: Store,
    public cartService: CartService
  ) { }

  async openModal(product: Product) {
    this.modalOpen = true;
    this.product = product;
    this.quantity = 1; // Reset quantity
    this.addToCartLoader = false; // Reset loader

    // Reset and find Size attribute
    this.sizeAttribute = null;
    this.selectedSize = null;
    this.waistAttribute = null;
    this.selectedWaist = null;

    if (this.product && this.product.attributes) {
      // Find attribute by name 'Size' (case-insensitive)
      this.sizeAttribute = this.product.attributes.find(attr =>
        attr.name.toLowerCase() === 'size'
      ) || null;

      if (this.sizeAttribute && this.sizeAttribute.attribute_values.length > 0) {
        // Select first value by default
        this.selectedSize = this.sizeAttribute.attribute_values[0];
      }

      // Find attribute by name 'Waist' (case-insensitive)
      this.waistAttribute = this.product.attributes.find(attr =>
        attr.name.toLowerCase() === 'waist'
      ) || null;

      if (this.waistAttribute && this.waistAttribute.attribute_values.length > 0) {
        // Select first value by default
        this.selectedWaist = this.waistAttribute.attribute_values[0];
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

  updateQuantity(qty: number) {
    if (this.quantity + qty >= 1) {
      this.quantity += qty;
    }
  }

  selectSize(value: AttributeValue) {
    this.selectedSize = value;
  }

  selectWaist(value: AttributeValue) {
    this.selectedWaist = value;
  }

  addToCart() {
    if (this.product) {
      this.addToCartLoader = true; // Start loader
      let selectedVariation: any = null;
      let selectedVariationId: number | null = null;

      // If product has variations
      if (this.product.type === 'classified' && this.product.variations && this.product.variations.length > 0) {

        // Find variation that matches the selected attributes (Size and/or Waist)
        const foundVariation = this.product.variations.find(variation => {
          let match = true;

          // Check Size match if size is selected
          if (this.selectedSize) {
            const sizeMatch = variation.attribute_values?.some(attrVal => attrVal.id === this.selectedSize?.id);
            if (!sizeMatch) match = false;
          }

          // Check Waist match if waist is selected
          if (this.selectedWaist) {
            const waistMatch = variation.attribute_values?.some(attrVal => attrVal.id === this.selectedWaist?.id);
            if (!waistMatch) match = false;
          }

          return match;
        });

        if (foundVariation) {
          selectedVariation = foundVariation;
          selectedVariationId = foundVariation.id;
        }
      }

      const params: CartAddOrUpdate = {
        id: null, // New item
        product: this.product,
        product_id: this.product.id,
        variation_id: selectedVariationId,
        variation: selectedVariation,
        quantity: this.quantity
      }

      this.store.dispatch(new AddToCart(params)).subscribe({
        complete: () => {
          this.addToCartLoader = false; // Stop loader
          this.closeModal();
        },
        error: () => {
          this.addToCartLoader = false; // Stop loader on error
        }
      });
    }
  }

  toggleWishlist(product: Product) {
    product['is_wishlist'] = !product['is_wishlist'];
    let action = product['is_wishlist'] ? new AddToWishlist({ product_id: product.id }) : new DeleteWishlist(product.id);
    if (action) {
      this.store.dispatch(action);
    }
  }

  ngOnDestroy() {
    if (this.modalOpen) {
      this.modalService.dismissAll();
    }
  }
}

